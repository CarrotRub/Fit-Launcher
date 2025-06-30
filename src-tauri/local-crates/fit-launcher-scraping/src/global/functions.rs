use anyhow::Result;
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::{StreamExt, future::Lazy, stream::FuturesOrdered};
use reqwest::{Client, header::RANGE};
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};
use tokio::{
    fs,
    io::{AsyncWriteExt, BufWriter},
    task::LocalSet,
    time::timeout,
};
use tracing::{error, info};

use crate::{
    errors::{CreatingFileErrorStruct, ScrapingError},
    structs::Game,
};

pub async fn download_sitemap(
    app_handle: tauri::AppHandle,
    url: &str,
    filename: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut response = CUSTOM_DNS_CLIENT.get(url).send().await?;

    let mut binding = app_handle.path().app_data_dir().unwrap();
    binding.push("sitemaps");

    let file_path = binding.join(format!("{}.xml", filename));

    let mut file = tokio::fs::File::create(&file_path).await?;
    while let Some(chunk) = response.chunk().await? {
        file.write_all(&chunk).await?;
    }

    Ok(())
}

async fn fetch_page(url: &str) -> Result<String, ScrapingError> {
    let fetch = CUSTOM_DNS_CLIENT.get(url).send();
    let resp = timeout(Duration::from_secs(20), fetch)
        .await
        .map_err(|_| ScrapingError::TimeoutError(url.into()))?
        .map_err(|e| ScrapingError::ReqwestError(e.to_string()))?;

    if !resp.status().is_success() {
        return Err(ScrapingError::HttpStatusCodeError(
            resp.status().to_string(),
        ));
    }
    resp.text()
        .await
        .map_err(|e| ScrapingError::ReqwestError(e.to_string()))
}

async fn write_games_to_file(
    app: &tauri::AppHandle,
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

async fn scrape_new_games_page(page: u32) -> Result<Vec<Game>, ScrapingError> {
    let url = format!(
        "https://fitgirl-repacks.site/category/lossless-repack/page/{}",
        page
    );
    let body = fetch_page(&url).await?;
    let document = scraper::Html::parse_document(&body);
    let article_selector = scraper::Selector::parse("article")
        .map_err(|e| ScrapingError::SelectorError(e.to_string()))?;

    let mut games = Vec::new();
    for article in document.select(&article_selector) {
        let title = article
            .select(&scraper::Selector::parse(".entry-title a").unwrap())
            .next()
            .map(|e| e.text().collect::<String>());

        let img = article
            .select(&scraper::Selector::parse(".entry-content .alignleft").unwrap())
            .next()
            .and_then(|e| e.value().attr("src"));

        let desc = article
            .select(&scraper::Selector::parse("div.entry-content").unwrap())
            .next()
            .map(|e| e.text().collect::<String>());

        let href = article
            .select(&scraper::Selector::parse(".entry-title > a").unwrap())
            .next()
            .and_then(|e| e.value().attr("href"));

        let tag = article
            .select(&scraper::Selector::parse(".entry-content p").unwrap())
            .find_map(|p| {
                let text = p.text().collect::<String>();
                if text.trim_start().starts_with("Genres/Tags:") {
                    Some(
                        p.select(&scraper::Selector::parse("a:not(:first-child)").unwrap()) // ignore the 'a > img' one
                            .map(|a| a.text().collect::<String>())
                            .collect::<Vec<_>>()
                            .join(", "),
                    )
                } else {
                    None
                }
            })
            .unwrap_or_default();

        let magnet = article
            .select(&scraper::Selector::parse("a[href*='magnet']").unwrap())
            .next()
            .and_then(|e| e.value().attr("href"));

        if let (Some(title), Some(img), Some(desc), Some(href), tag, Some(magnet)) =
            (title, img, desc, href, tag, magnet)
        {
            if img.contains("imageban") {
                games.push(Game {
                    title,
                    img: img.to_string(),
                    desc,
                    magnetlink: magnet.to_string(),
                    href: href.to_string(),
                    tag,
                });
            }
        }
    }
    Ok(games)
}

pub async fn scraping_func(app_handle: tauri::AppHandle) -> Result<(), Box<ScrapingError>> {
    let start = Instant::now();
    let pages = FuturesOrdered::from_iter((1..=2).map(scrape_new_games_page));

    let results: Vec<_> = pages.collect().await;
    let mut games = Vec::new();

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

async fn scrape_popular_game(link: &str) -> Result<Game, ScrapingError> {
    let body = fetch_page(link).await?;
    let doc = scraper::Html::parse_document(&body);

    let title = doc
        .select(&scraper::Selector::parse(".entry-title").unwrap())
        .next()
        .map(|e| e.text().collect())
        .unwrap_or_default();

    let desc = doc
        .select(&scraper::Selector::parse("div.entry-content").unwrap())
        .next()
        .map(|e| e.text().collect())
        .unwrap_or_default();

    let magnet = doc
        .select(&scraper::Selector::parse("a[href*='magnet']").unwrap())
        .next()
        .and_then(|e| e.value().attr("href"))
        .unwrap_or_default();

    let tag = doc
        .select(&scraper::Selector::parse(".entry-content p").unwrap())
        .find_map(|p| {
            let text = p.text().collect::<String>();
            if text.trim_start().starts_with("Genres/Tags:") {
                Some(
                    p.select(&scraper::Selector::parse("a").unwrap())
                        .map(|a| a.text().collect::<String>())
                        .collect::<Vec<_>>()
                        .join(", "),
                )
            } else {
                None
            }
        })
        .unwrap_or_default();

    let mut img_url = None;
    for i in 3..10 {
        let selector = match scraper::Selector::parse(&format!(
            ".entry-content > p:nth-of-type({}) a[href] > img[src]:nth-child(1)",
            i
        )) {
            Ok(sel) => sel,
            Err(_) => continue,
        };

        if let Some(element) = doc.select(&selector).next() {
            if let Some(src) = element.value().attr("src") {
                let final_url = if src.contains("240p") {
                    let hi_res = src.replace("240p", "1080p");
                    if check_url_status(&hi_res).await {
                        hi_res
                    } else {
                        src.replace("jpg.1080p.", "")
                    }
                } else {
                    src.to_string()
                };
                img_url = Some(final_url);
                break;
            }
        }
    }

    let img = img_url.unwrap_or_default();

    Ok(Game {
        title,
        img,
        desc,
        magnetlink: magnet.to_string(),
        href: link.to_string(),
        tag,
    })
}

pub async fn popular_games_scraping_func(
    app_handle: tauri::AppHandle,
) -> Result<(), Box<ScrapingError>> {
    let start = Instant::now();
    let body = fetch_page("https://fitgirl-repacks.site/popular-repacks/").await?;
    let doc = scraper::Html::parse_document(&body);

    let links = doc
        .select(&scraper::Selector::parse(".widget-grid-view-image > a").unwrap())
        .filter_map(|e| e.value().attr("href"))
        .take(8)
        .map(str::to_owned)
        .collect::<Vec<_>>();

    let games = FuturesOrdered::from_iter(links.iter().map(|link| scrape_popular_game(link)))
        .collect::<Vec<_>>()
        .await;

    let mut valid_games = Vec::new();
    for game in games {
        match game {
            Ok(g) => valid_games.push(g),
            Err(e) => error!("Popular game scrape failed: {:?}", e),
        }
    }

    write_games_to_file(&app_handle, &valid_games, "popular_games.json").await?;
    info!("Popular games scraped in {:?}", start.elapsed());
    Ok(())
}

async fn scrape_recent_update(link: &str) -> Result<Game, ScrapingError> {
    let body = fetch_page(link).await?;
    let doc = scraper::Html::parse_document(&body);

    let title = doc
        .select(&scraper::Selector::parse(".entry-title").unwrap())
        .next()
        .map(|e| e.text().collect())
        .unwrap_or_default();

    let desc = doc
        .select(&scraper::Selector::parse("div.entry-content").unwrap())
        .next()
        .map(|e| e.text().collect())
        .unwrap_or_default();

    let magnet = doc
        .select(&scraper::Selector::parse("a[href*='magnet']").unwrap())
        .next()
        .and_then(|e| e.value().attr("href"))
        .unwrap_or_default();

    let img = doc
        .select(&scraper::Selector::parse(".entry-content > p > a > img").unwrap())
        .next()
        .and_then(|e| e.value().attr("src"))
        .unwrap_or_default();

    let tag = doc
        .select(&scraper::Selector::parse(".entry-content p").unwrap())
        .find_map(|p| {
            let text = p.text().collect::<String>();
            if text.trim_start().starts_with("Genres/Tags:") {
                Some(
                    p.select(&scraper::Selector::parse("a").unwrap())
                        .map(|a| a.text().collect::<String>())
                        .collect::<Vec<_>>()
                        .join(", "),
                )
            } else {
                None
            }
        })
        .unwrap_or_default();

    Ok(Game {
        title,
        img: img.to_string(),
        desc,
        magnetlink: magnet.to_string(),
        href: link.to_string(),
        tag,
    })
}

pub async fn recently_updated_games_scraping_func(
    app_handle: tauri::AppHandle,
) -> Result<(), Box<ScrapingError>> {
    let start = Instant::now();
    let body = fetch_page("https://fitgirl-repacks.site/category/updates-digest/").await?;
    let doc = scraper::Html::parse_document(&body);

    let links = doc
        .select(&scraper::Selector::parse(".su-spoiler-content > a:first-child").unwrap())
        .filter_map(|e| e.value().attr("href"))
        .take(20)
        .map(str::to_owned)
        .collect::<Vec<_>>();

    let games = FuturesOrdered::from_iter(links.iter().map(|link| scrape_recent_update(link)))
        .collect::<Vec<_>>()
        .await;

    let mut valid_games = Vec::new();
    for game in games {
        match game {
            Ok(g) => valid_games.push(g),
            Err(e) => {
                app_handle
                    .emit("scraping_failed", format!("Game scrape failed: {}", e))
                    .unwrap();
            }
        }
    }

    write_games_to_file(&app_handle, &valid_games, "recently_updated_games.json").await?;
    app_handle
        .emit("scraping_complete", "Recent updates scraped")
        .unwrap();
    info!("Recent updates scraped in {:?}", start.elapsed());
    Ok(())
}

pub async fn run_all_scrapers(app_handle: Arc<tauri::AppHandle>) -> anyhow::Result<()> {
    let start = Instant::now();
    // We need LocalSet because scraper’s HTML nodes aren’t Send.
    let local = LocalSet::new();
    let app = app_handle.clone();

    local
        .run_until(async {
            let a = tokio::task::spawn_local(scraping_func(app.as_ref().clone()));
            let b = tokio::task::spawn_local(popular_games_scraping_func(app.as_ref().clone()));
            let c = tokio::task::spawn_local(recently_updated_games_scraping_func(
                app.as_ref().clone(),
            ));

            // if one fails we still await the others
            let (ra, rb, rc) = tokio::join!(a, b, c);
            ra??;
            rb??;
            rc??;
            Ok::<_, anyhow::Error>(())
        })
        .await?;

    info!("ALL scrapers done in {:?}", start.elapsed());
    Ok(())
}

async fn check_url_status(url: &str) -> bool {
    CUSTOM_DNS_CLIENT
        .head(url)
        .header(RANGE, "bytes=0-8")
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}
