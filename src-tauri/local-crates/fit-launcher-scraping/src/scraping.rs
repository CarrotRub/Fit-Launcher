//! Core scraping logic for game data.

use std::time::{Duration, Instant};

use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::{StreamExt, stream::FuturesOrdered};
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

// ============================================================================
// HTTP Fetching
// ============================================================================

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

/// Fetch a page with DDOS-Guard bypass if needed
pub async fn fetch_page(url: &str, app: &AppHandle) -> Result<String, ScrapingError> {
    let client = CUSTOM_DNS_CLIENT.read().await.clone();
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
            return Err(ScrapingError::HttpStatusCodeError(
                resp.status().to_string(),
            ));
        }

        return resp
            .text()
            .await
            .map_err(|e| ScrapingError::ReqwestError(e.to_string()));
    }
}

// ============================================================================
// Scraping Functions
// ============================================================================

/// Write list of games to database by category
fn write_games_to_db(app: &AppHandle, games: &[Game], category: &str) -> Result<(), ScrapingError> {
    let conn = db::open_connection(app)?;
    db::set_category_games(&conn, category, games, hash_url)
}

/// Scrape a single page of new games
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

/// Scrape newly added games (pages 1-2)
pub async fn scrape_new_games(app: AppHandle) -> Result<(), ScrapingError> {
    let start = Instant::now();

    let futures = (1..=2).map(|page| {
        let ah = app.clone();
        async move { scrape_new_games_page(page, ah).await }
    });

    let mut games = Vec::new();
    let results: Vec<_> = FuturesOrdered::from_iter(futures).collect().await;

    for result in results {
        match result {
            Ok(mut page_games) => games.append(&mut page_games),
            Err(e) => error!("Page scrape failed: {:?}", e),
        }
    }

    // Check if we already have these games (early exit)
    let conn = db::open_connection(&app)?;
    let existing_games = db::get_games_by_category(&conn, "newly_added").unwrap_or_default();

    // Only skip if the first (newest) game is the same
    if let (Some(first_new), Some(first_existing)) = (games.first(), existing_games.first()) {
        if first_new.title == first_existing.title {
            info!("First game unchanged, skipping update");
            return Ok(());
        }
    }

    write_games_to_db(&app, &games, "newly_added")?;
    info!("New games scraped in {:?}", start.elapsed());
    Ok(())
}

/// Scrape one popular game page
async fn scrape_popular_game(link: &str, app: &AppHandle) -> Result<Game, ScrapingError> {
    let body = fetch_page(link, app).await?;
    let doc = Html::parse_document(&body);
    let article = doc
        .select(&scraper::Selector::parse("article").unwrap())
        .next()
        .ok_or(ScrapingError::ArticleNotFound(link.into()))?;

    let mut game = parse_game_from_article(article);
    game.img = find_preview_image(article).unwrap_or_default();
    Ok(game)
}

/// Scrape popular games
pub async fn scrape_popular_games(app: AppHandle) -> Result<(), ScrapingError> {
    let start = Instant::now();
    let body = fetch_page("https://fitgirl-repacks.site/popular-repacks/", &app).await?;
    let doc = Html::parse_document(&body);

    let links: Vec<String> = doc
        .select(&scraper::Selector::parse(".widget-grid-view-image > a").unwrap())
        .filter_map(|e| e.value().attr("href"))
        .take(8)
        .map(str::to_owned)
        .collect();

    let stream = futures::stream::iter(links.into_iter().map(|link| {
        let ah = app.clone();
        async move { scrape_popular_game(&link, &ah).await }
    }))
    .buffer_unordered(3);

    let mut valid_games = Vec::new();
    futures::pin_mut!(stream);
    while let Some(result) = stream.next().await {
        match result {
            Ok(game) => valid_games.push(game),
            Err(e) => error!("Popular game scrape failed: {:?}", e),
        }
    }

    write_games_to_db(&app, &valid_games, "popular")?;
    info!("Popular games scraped in {:?}", start.elapsed());
    Ok(())
}

/// Scrape one recently updated game
async fn scrape_recent_update(link: &str, app: AppHandle) -> Result<Game, ScrapingError> {
    let body = fetch_page(link, &app).await?;
    let doc = Html::parse_document(&body);
    let article = doc
        .select(&scraper::Selector::parse("article").unwrap())
        .next()
        .ok_or(ScrapingError::ArticleNotFound(link.to_string()))?;

    Ok(parse_game_from_article(article))
}

/// Scrape recently updated games
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
        .take(20)
        .map(str::to_owned)
        .collect();

    let futures = links.into_iter().map(|link| {
        let ah = app.clone();
        async move { scrape_recent_update(&link, ah).await }
    });

    let games: Vec<_> = FuturesOrdered::from_iter(futures).collect().await;
    let valid_games: Vec<Game> = games.into_iter().filter_map(|r| r.ok()).collect();

    write_games_to_db(&app, &valid_games, "recently_updated")?;
    app.emit("scraping_complete", "Recent updates scraped").ok();
    info!("Recent updates scraped in {:?}", start.elapsed());
    Ok(())
}

/// Run all scrapers concurrently
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
