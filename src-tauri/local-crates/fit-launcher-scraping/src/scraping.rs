//! Core scraping logic for game data.

use std::time::{Duration, Instant};

use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::StreamExt;
use itertools::Itertools;
use reqwest::Response;
use scraper::Html;
use tauri::{AppHandle, Emitter};
use tokio::time::timeout;
use tracing::{error, info, warn};

use crate::captcha::handle_ddos_guard_captcha;
use crate::db::{self, hash_url};
use crate::errors::ScrapingError;
use crate::parser::{find_preview_image, parse_game_from_article};
use crate::structs::Game;

fn likely_guarded(resp: &Response) -> bool {
    resp.status().as_u16() == 403
        && resp
            .headers()
            .get("server")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_lowercase().contains("ddos-guard"))
            .unwrap_or(false)
}

async fn get_response(client: &reqwest::Client, url: &str) -> Result<Response, ScrapingError> {
    let fetch = client.get(url).send();
    timeout(Duration::from_secs(60), fetch)
        .await
        .map_err(|_| ScrapingError::TimeoutError(url.into()))?
        .map_err(|e| ScrapingError::ReqwestError(e.to_string()))
}

pub async fn fetch_page(url: &str, app: &AppHandle) -> Result<String, ScrapingError> {
    let client = CUSTOM_DNS_CLIENT.read().await.clone();
    let mut tries = 0u32;
    loop {
        let resp = get_response(&client, url).await?;

        if likely_guarded(&resp) {
            let cookies = resp.cookies().collect::<Vec<_>>();
            warn!("cookies: {cookies:?}, status: {}", resp.status().as_u16());

            match handle_ddos_guard_captcha(app, url).await {
                Ok(_) => continue,
                Err(e) => error!("captcha handler error: {e}"),
            }
        }

        if !resp.status().is_success() {
            return Err(ScrapingError::HttpStatusCodeError(format!(
                "{} - {}",
                resp.status(),
                url
            )));
        }

        match resp.text().await {
            Err(_) if tries < 5 => tries += 1,
            Err(e) => Err(ScrapingError::ReqwestError(e.to_string()))?,
            Ok(content) => break Ok(content),
        }
    }
}

fn write_games_to_db(app: &AppHandle, games: &[Game], category: &str) -> Result<(), ScrapingError> {
    let conn = db::open_connection(app)?;
    db::set_category_games(&conn, category, games, hash_url)
}

async fn scrape_new_games_page(page: u32, app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    let url = format!("https://fitgirl-repacks.site/category/lossless-repack/page/{page}");
    let body = fetch_page(&url, &app).await?;
    let document = Html::parse_document(&body);
    let article_selector = scraper::Selector::parse("article")
        .map_err(|e| ScrapingError::SelectorError(format!("{:?}", e)))?;

    let mut games = Vec::new();
    for article in document.select(&article_selector) {
        let game = parse_game_from_article(article);
        if game.title.is_empty() || game.img.is_empty() || game.href.is_empty() {
            continue;
        }
        games.push(game);
    }
    Ok(games)
}

pub async fn scrape_new_games(app: AppHandle) -> Result<(), ScrapingError> {
    let start = Instant::now();

    const PAGE_COUNT: u32 = 3;

    let stream = futures::stream::iter(0..PAGE_COUNT)
        .map(|page| {
            let ah = app.clone();
            async move {
                let res = scrape_new_games_page(page, ah).await;
                (page, res)
            }
        })
        .buffer_unordered(2);

    let mut per_page: Vec<Vec<Game>> = vec![Vec::new(); PAGE_COUNT as usize];

    futures::pin_mut!(stream);
    while let Some((page, result)) = stream.next().await {
        match result {
            Ok(mut page_games) => {
                per_page[page as usize].append(&mut page_games);
            }
            Err(e) => {
                error!("Page {} scrape failed: {:?}", page, e);
            }
        }
    }

    let scraped_games: Vec<Game> = per_page.into_iter().flatten().collect();

    if scraped_games.is_empty() {
        warn!("No newly added games found on website");
        return Ok(());
    }

    let current_urls: std::collections::HashSet<_> =
        scraped_games.iter().map(|g| g.href.clone()).collect();

    let conn = db::open_connection(&app)?;
    let existing_games = db::get_games_by_category(&conn, "newly_added").unwrap_or_default();

    let existing_urls: std::collections::HashSet<_> =
        existing_games.iter().map(|g| g.href.clone()).collect();

    if current_urls == existing_urls && existing_games.len() == scraped_games.len() {
        info!(
            "Newly added games already in sync ({} games), skipping",
            existing_games.len()
        );
        return Ok(());
    }

    info!(
        "Syncing newly added games: {} on site, {} in DB",
        scraped_games.len(),
        existing_games.len()
    );

    write_games_to_db(&app, &scraped_games, "newly_added")?;
    info!("New games synced in {:?}", start.elapsed());

    Ok(())
}

/// Always syncs with website's current popular list - compares URLs with DB,
/// reuses existing data, fetches only new games.
pub async fn scrape_popular_games(app: AppHandle) -> Result<(), ScrapingError> {
    let start = Instant::now();

    let body = fetch_page("https://fitgirl-repacks.site/popular-repacks/", &app).await?;
    let doc = Html::parse_document(&body);

    let popular_data: Vec<(String, String)> = doc
        .select(&scraper::Selector::parse(".widget-grid-view-image > a").unwrap())
        .filter_map(|a| {
            let href = a.value().attr("href")?.to_string();
            let img = a
                .select(&scraper::Selector::parse("img").unwrap())
                .next()
                .and_then(|i| i.value().attr("src"))
                .map(str::to_string)
                .unwrap_or_default();
            Some((href, img))
        })
        .unique()
        .take(20)
        .collect();

    if popular_data.is_empty() {
        warn!("No popular games found on website");
        return Ok(());
    }

    let current_urls: std::collections::HashSet<_> =
        popular_data.iter().map(|(href, _)| href.clone()).collect();

    let conn = db::open_connection(&app)?;
    let existing_games = db::get_games_by_category(&conn, "popular").unwrap_or_default();
    let existing_urls: std::collections::HashSet<_> =
        existing_games.iter().map(|g| g.href.clone()).collect();

    if current_urls == existing_urls && existing_games.len() == popular_data.len() {
        info!(
            "Popular games already in sync ({} games), skipping",
            existing_games.len()
        );
        return Ok(());
    }

    info!(
        "Syncing popular games: {} on site, {} in DB",
        popular_data.len(),
        existing_games.len()
    );

    let mut final_games = Vec::with_capacity(popular_data.len());
    let mut missing = Vec::new();

    for (idx, (href, thumb_img)) in popular_data.iter().enumerate() {
        let url_hash = hash_url(href);
        if let Ok(Some(mut game)) = db::get_game_by_hash(&conn, url_hash) {
            if game.img.is_empty() || !game.img.contains("imageban") {
                game.img = thumb_img.clone();
            }
            final_games.push(game);
        } else {
            final_games.push(Game::default());
            missing.push((idx, href.clone(), thumb_img.clone()));
        }
    }
    drop(conn);

    let fetched_count = missing.len();
    if !missing.is_empty() {
        info!("Fetching {} new popular games", fetched_count);

        let stream = futures::stream::iter(missing.into_iter())
            .map(|(idx, link, thumb)| {
                let ah = app.clone();
                async move {
                    let body = fetch_page(&link, &ah).await?;
                    let doc = Html::parse_document(&body);
                    let article = doc
                        .select(&scraper::Selector::parse("article").unwrap())
                        .next()
                        .ok_or(ScrapingError::ArticleNotFound(link.clone()))?;

                    let mut game = parse_game_from_article(article);
                    if game.img.is_empty() {
                        game.img = thumb.clone();
                    }
                    if game.img.is_empty() {
                        game.img = find_preview_image(article).unwrap_or_default();
                    }

                    Ok::<(usize, Game), ScrapingError>((idx, game))
                }
            })
            .buffer_unordered(10);

        futures::pin_mut!(stream);
        while let Some(result) = stream.next().await {
            match result {
                Ok((idx, game)) => final_games[idx] = game,
                Err(e) => error!("Popular game scrape failed: {:?}", e),
            }
        }

        final_games.retain(|g| !g.href.is_empty());
    }

    write_games_to_db(&app, &final_games, "popular")?;
    info!(
        "Popular games synced in {:?} ({} games, {} fetched)",
        start.elapsed(),
        final_games.len(),
        fetched_count
    );

    Ok(())
}

pub async fn scrape_recently_updated(app: AppHandle) -> Result<(), ScrapingError> {
    let start = Instant::now();

    let body = fetch_page(
        "https://fitgirl-repacks.site/category/updates-digest/",
        &app,
    )
    .await?;
    let doc = Html::parse_document(&body);

    let links: Vec<String> = doc
        .select(&scraper::Selector::parse(".su-spoiler-content > a:first-child").unwrap())
        .filter_map(|e| e.value().attr("href"))
        .filter(|href| {
            href.starts_with("https://fitgirl-repacks.site/")
                && !href.contains('<')
                && !href.contains('>')
        })
        .unique()
        .take(20)
        .map(str::to_owned)
        .collect();

    if links.is_empty() {
        warn!("No recently updated game links found on website");
        return Ok(());
    }

    let current_urls: std::collections::HashSet<_> = links.iter().cloned().collect();

    let conn = db::open_connection(&app)?;
    let existing = db::get_games_by_category(&conn, "recently_updated").unwrap_or_default();
    let existing_urls: std::collections::HashSet<_> =
        existing.iter().map(|g| g.href.clone()).collect();

    if current_urls == existing_urls && existing.len() == links.len() {
        info!(
            "Recently updated games already in sync ({} games), skipping",
            existing.len()
        );
        return Ok(());
    }

    info!(
        "Syncing recently updated games: {} on site, {} in DB",
        links.len(),
        existing.len()
    );

    let mut final_games: Vec<Game> = vec![Game::default(); links.len()];
    let mut missing = Vec::new();

    for (idx, href) in links.iter().enumerate() {
        let url_hash = hash_url(href);
        if let Ok(Some(game)) = db::get_game_by_hash(&conn, url_hash) {
            final_games[idx] = game;
        } else {
            missing.push((idx, href.clone()));
        }
    }
    drop(conn);

    if !missing.is_empty() {
        info!(
            "Fetching {} recently updated games not in DB",
            missing.len()
        );

        let stream = futures::stream::iter(missing.into_iter())
            .map(|(idx, link)| {
                let ah = app.clone();
                async move {
                    let body = fetch_page(&link, &ah).await?;
                    let doc = Html::parse_document(&body);
                    let article = doc
                        .select(&scraper::Selector::parse("article").unwrap())
                        .next()
                        .ok_or(ScrapingError::ArticleNotFound(link.clone()))?;

                    Ok::<(usize, Game), ScrapingError>((idx, parse_game_from_article(article)))
                }
            })
            .buffer_unordered(10);

        futures::pin_mut!(stream);
        while let Some(result) = stream.next().await {
            match result {
                Ok((idx, game)) => final_games[idx] = game,
                Err(e) => error!("Recent update scrape failed: {:?}", e),
            }
        }
    }

    // Drop any still-empty slots (failed fetches)
    final_games.retain(|g| !g.href.is_empty());

    write_games_to_db(&app, &final_games, "recently_updated")?;
    app.emit("scraping_complete", "Recent updates scraped").ok();
    info!("Recent updates synced in {:?}", start.elapsed());

    Ok(())
}

pub async fn run_all_scrapers(app: AppHandle) -> Result<(), ScrapingError> {
    let start = Instant::now();

    let local = tokio::task::LocalSet::new();

    let a = tokio::spawn(scrape_new_games(app.clone()));
    let c = tokio::spawn(scrape_recently_updated(app.clone()));

    let b = local.run_until(async { scrape_popular_games(app.clone()).await });

    let (ra, rb, rc) = tokio::join!(a, b, c);

    ra.map_err(|e| ScrapingError::GeneralError(e.to_string()))??;
    rb?;
    rc.map_err(|e| ScrapingError::GeneralError(e.to_string()))??;

    info!("All scrapers done in {:?}", start.elapsed());
    Ok(())
}
