
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::{StreamExt, stream, stream::FuturesOrdered};
use reqwest::Response;
use std::{

    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{
    fs,
    io::{AsyncWriteExt, BufWriter},
    time::timeout,
};
use tracing::{error, info, warn};

use crate::{
    errors::{CreatingFileErrorStruct, ScrapingError},
    global::{
        captcha::handle_ddos_guard_captcha,
        functions::helper::{fetch_game_info, find_preview_image},
    },
    structs::Game,
};

/// Download a sitemap file with DNS client and write it to app data.
pub async fn download_sitemap(app_handle: AppHandle, url: &str, filename: &str) -> anyhow::Result<()> {
    let mut response = CUSTOM_DNS_CLIENT.read().await.get(url).send().await?;

    let mut binding = app_handle.path().app_data_dir().unwrap();
    binding.push("sitemaps");
    fs::create_dir_all(&binding).await?;

    let file_path = binding.join(format!("{filename}.xml"));
    let mut file = tokio::fs::File::create(&file_path).await?;

    while let Some(chunk) = response.chunk().await? {
        file.write_all(&chunk).await?;
    }

    Ok(())
}

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

/// Fetch a page with DDOS-Guard bypass if needed.
pub(crate) async fn fetch_page(url: &str, app: &AppHandle) -> Result<String, ScrapingError> {
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

/// Write list of games into a JSON file (atomic write).
async fn write_games_to_file(
    app: &AppHandle,
    games: &[Game],
    file: &str,
) -> Result<(), ScrapingError> {
    let mut dir = app.path().app_data_dir().unwrap();
    dir.push("tempGames");
    fs::create_dir_all(&dir).await.map_err(|e| {
        ScrapingError::CreatingFileError(CreatingFileErrorStruct {
            source: e.to_string(),
            fn_name: "write_games_to_file".into(),
        })
    })?;

    let final_path = dir.join(file);
    let tmp_path = dir.join(format!("{file}.tmp"));

    let json = serde_json::to_string_pretty(games)
        .map_err(|e| ScrapingError::FileJSONError(e.to_string()))?;

    let mut file = BufWriter::new(fs::File::create(&tmp_path).await.map_err(|e| {
        ScrapingError::CreatingFileError(CreatingFileErrorStruct {
            source: e.to_string(),
            fn_name: "write_games_to_file".into(),
        })
    })?);

    file.write_all(json.as_bytes()).await.map_err(|e| {
        ScrapingError::CreatingFileError(CreatingFileErrorStruct {
            source: e.to_string(),
            fn_name: "write_games_to_file".into(),
        })
    })?;
    file.flush().await.ok();

    fs::rename(&tmp_path, &final_path).await.map_err(|e| {
        ScrapingError::CreatingFileError(CreatingFileErrorStruct {
            source: e.to_string(),
            fn_name: "write_games_to_file".into(),
        })
    })
}

/// Scrape a new games page.
async fn scrape_new_games_page(page: u32, app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    let url = format!("https://fitgirl-repacks.site/category/lossless-repack/page/{page}");
    let body = fetch_page(&url, &app).await?;
    let document = scraper::Html::parse_document(&body);
    let article_selector = scraper::Selector::parse("article")
        .map_err(|e| ScrapingError::SelectorError(e.to_string()))?;

    let mut games = Vec::new();
    for article in document.select(&article_selector) {
        let game = fetch_game_info(article);
        if game.title.is_empty()
            || game.desc.is_empty()
            || game.img.is_empty()
            || game.href.is_empty()
        {
            continue;
        }
        games.push(game);
    }
    Ok(games)
}

/// Scrape newly added games.
pub async fn scraping_func(app_handle: AppHandle) -> Result<(), ScrapingError> {
    let start = Instant::now();

    let futures = (1..=2).map(|page| {
        let ah = app_handle.clone();
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

    let mut dir = app_handle.path().app_data_dir().unwrap();
    dir.push("tempGames");
    let json_path = dir.join("newly_added_games.json");

    let existing_games = if json_path.exists() {
        let data = fs::read_to_string(&json_path).await.map_err(|e| {
            ScrapingError::CreatingFileError(CreatingFileErrorStruct {
                source: e.to_string(),
                fn_name: "scraping_func".to_string(),
            })
        })?;
        serde_json::from_str::<Vec<Game>>(&data)
            .map_err(|e| ScrapingError::FileJSONError(e.to_string()))?
    } else {
        Vec::new()
    };

    if games
        .iter()
        .zip(existing_games.iter())
        .any(|(new, old)| new.title == old.title)
    {
        info!("Found matching game, stopping early");
        return Ok(());
    }

    write_games_to_file(&app_handle, &games, "newly_added_games.json").await?;
    info!("New games scraped in {:?}", start.elapsed());
    Ok(())
}

/// Scrape one popular game.
async fn scrape_popular_game(link: &str, app: &AppHandle) -> Result<Game, ScrapingError> {
    let body = fetch_page(link, app).await?;
    let doc = scraper::Html::parse_document(&body);
    let article = doc
        .select(&scraper::Selector::parse("article").unwrap())
        .next()
        .ok_or(ScrapingError::ArticleNotFound(link.into()))?;

    let mut game = fetch_game_info(article);
    game.img = find_preview_image(article).unwrap_or_default();
    Ok(game)
}

pub async fn popular_games_scraping_func(app_handle: AppHandle) -> Result<(), ScrapingError> {
    let start = Instant::now();
    let body = fetch_page("https://fitgirl-repacks.site/popular-repacks/", &app_handle).await?;
    let doc = scraper::Html::parse_document(&body);

    let links: Vec<String> = doc
        .select(&scraper::Selector::parse(".widget-grid-view-image > a").unwrap())
        .filter_map(|e| e.value().attr("href"))
        .take(8)
        .map(str::to_owned)
        .collect();

    let stream = futures::stream::iter(links.into_iter().map(|link| {
        let ah = app_handle.clone();
        async move {
            scrape_popular_game(&link, &ah).await
        }
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

    write_games_to_file(&app_handle, &valid_games, "popular_games.json").await?;
    info!("Popular games scraped in {:?}", start.elapsed());
    Ok(())
}

/// Scrape one recently updated game.
async fn scrape_recent_update(link: &str, app: AppHandle) -> Result<Game, ScrapingError> {
    let body = fetch_page(link, &app).await?;
    let doc = scraper::Html::parse_document(&body);
    let article = doc
        .select(&scraper::Selector::parse("article").unwrap())
        .next()
        .ok_or(ScrapingError::ArticleNotFound(link.to_string()))?;

    Ok(fetch_game_info(article))
}

/// Scrape recently updated games.
pub async fn recently_updated_games_scraping_func(
    app_handle: AppHandle,
) -> Result<(), ScrapingError> {
    let start = Instant::now();
    let body = fetch_page(
        "https://fitgirl-repacks.site/category/updates-digest/",
        &app_handle,
    )
    .await?;
    let doc = scraper::Html::parse_document(&body);

    let links: Vec<String> = doc
        .select(&scraper::Selector::parse(".su-spoiler-content > a:first-child").unwrap())
        .filter_map(|e| e.value().attr("href"))
        .take(20)
        .map(str::to_owned)
        .collect();

    let futures = links.into_iter().map(|link| {
        let ah = app_handle.clone();
        async move { scrape_recent_update(&link, ah).await }
    });

    let games: Vec<_> = FuturesOrdered::from_iter(futures).collect().await;
    let valid_games: Vec<Game> = games.into_iter().filter_map(|r| r.ok()).collect();

    write_games_to_file(&app_handle, &valid_games, "recently_updated_games.json").await?;
    app_handle
        .emit("scraping_complete", "Recent updates scraped")
        .ok();
    info!("Recent updates scraped in {:?}", start.elapsed());
    Ok(())
}

/// Run all scrapers concurrently, Send-safe.
pub async fn run_all_scrapers(app_handle: AppHandle) -> anyhow::Result<()> {
    let start = Instant::now();

    let local = tokio::task::LocalSet::new();

    let a = tokio::spawn(scraping_func(app_handle.clone()));
    let c = tokio::spawn(recently_updated_games_scraping_func(app_handle.clone()));

    let b = local.run_until(async {
        popular_games_scraping_func(app_handle.clone()).await
    });

    let (ra, rb, rc) = tokio::join!(a, b, c);

    ra??;
    rb?;
    rc??;

    info!("All scrapers done in {:?}", start.elapsed());
    Ok(())
}

pub mod helper;
