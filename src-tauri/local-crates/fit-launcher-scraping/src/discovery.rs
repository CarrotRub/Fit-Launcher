//! Discovery games rotation logic.
//!
//! Maintains a rotating pool of ~100 discovery games, refreshing periodically.

use std::collections::HashSet;

use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::{StreamExt, stream};
use rand::{prelude::*, rng};
use scraper::{Html, Selector};
use serde_with::chrono::{self, DateTime, Utc};
use tauri::{AppHandle, Emitter, Manager};
use tracing::info;

use crate::db::{self, hash_url};
use crate::errors::ScrapingError;
use crate::parser::{extract_secondary_images, parse_game_from_article};
use crate::scraping::fetch_page;
use crate::structs::Game;

const TARGET: usize = 100;
const BATCH: usize = 10;
const REFRESH_DAYS: i64 = 1;

macro_rules! sel {
    ($s:literal) => {
        &*std::sync::LazyLock::new(|| Selector::parse($s).unwrap())
    };
}

async fn head_ok(url: &str) -> bool {
    CUSTOM_DNS_CLIENT
        .read()
        .await
        .head(url)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

async fn fix_img(src: &str) -> String {
    if !src.contains("jpg.240p.") {
        return src.into();
    }
    let hi = src.replace("240p", "1080p");
    if head_ok(&hi).await {
        return hi;
    }
    let mid = hi.replace("jpg.1080p.", "");
    if head_ok(&mid).await {
        return mid;
    }
    src.into()
}

fn parse_discovery_article(article: scraper::element_ref::ElementRef) -> Option<Game> {
    let mut game = parse_game_from_article(article);

    // Only include games with imageban images
    if !game.img.contains("imageban") {
        return None;
    }

    game.secondary_images = extract_secondary_images(article);
    Some(game)
}

async fn fetch_discovery_page(n: u32, app: &AppHandle) -> Result<Vec<Game>, ScrapingError> {
    let url = format!("https://fitgirl-repacks.site/category/lossless-repack/page/{n}");
    let body = fetch_page(&url, app).await?;

    let doc = Html::parse_document(&body);
    let mut games = Vec::new();
    for art in doc.select(sel!("article")) {
        if let Some(g) = parse_discovery_article(art) {
            games.push(g);
        }
    }
    Ok(games)
}

fn read_meta_ts(conn: &rusqlite::Connection) -> Option<DateTime<Utc>> {
    db::get_metadata(conn, "discovery_last_refresh")
        .ok()
        .flatten()
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&Utc))
}

fn write_meta_ts(conn: &rusqlite::Connection) {
    let _ = db::set_metadata(conn, "discovery_last_refresh", &Utc::now().to_rfc3339());
}

/// Refresh discovery games pool, maintaining ~100 games with periodic rotation
pub async fn refresh_discovery_games(app: AppHandle) -> Result<(), ScrapingError> {
    let conn = db::open_connection(&app)?;

    // Load existing discovery games
    let mut queue: Vec<Game> = db::get_games_by_category(&conn, "discovery").unwrap_or_default();

    let too_old = match read_meta_ts(&conn) {
        Some(ts) => Utc::now() - ts > chrono::Duration::days(REFRESH_DAYS),
        None => true,
    };

    if queue.len() >= TARGET && !too_old {
        queue.shuffle(&mut rng());
        db::set_category_games(&conn, "discovery", &queue, hash_url)?;
        info!("cache fresh (<{REFRESH_DAYS} days) - shuffled only");
        return Ok(());
    }

    let mut have: HashSet<String> = queue.iter().map(|g| g.title.clone()).collect();

    let mut page = 1;
    while queue.len() < TARGET && page <= 10 {
        let mut fresh = Vec::<Game>::new();

        while fresh.len() < BATCH && page <= 10 {
            let mut page_games = fetch_discovery_page(page, &app).await?;
            for g in page_games.drain(..) {
                if have.insert(g.title.clone()) {
                    fresh.push(g);
                    if fresh.len() == BATCH {
                        break;
                    }
                }
            }
            page += 1;
        }

        if fresh.is_empty() {
            break;
        }

        // Upgrade secondary image quality
        for g in &mut fresh {
            g.secondary_images = stream::iter(g.secondary_images.clone())
                .map(|s| async move { fix_img(&s).await })
                .buffer_unordered(5)
                .collect::<Vec<_>>()
                .await;
        }

        queue.splice(0..0, fresh);
        if queue.len() > TARGET {
            queue.truncate(TARGET)
        }
        queue.shuffle(&mut rng());

        db::set_category_games(&conn, "discovery", &queue, hash_url)?;
        info!("wrote batch, queue size now {}", queue.len());
    }

    write_meta_ts(&conn);
    info!("queue ready with {} games", queue.len());

    if let Some(main) = app.get_window("main") {
        let _ = main.emit("discovery-ready", ());
    }

    Ok(())
}
