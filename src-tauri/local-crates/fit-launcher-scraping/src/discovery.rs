use crate::{
    errors::ScrapingError, global::functions::helper::fetch_game_info, structs::DiscoveryGame,
};
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::{StreamExt, stream};
use once_cell::sync::Lazy;
use rand::{prelude::*, rng};
// TODO: Add check cuz everytime is too much

use scraper::{Html, Selector};
use serde_with::chrono::{self, DateTime, Utc};
use tokio::fs;

const TARGET: usize = 100; // keep exactly this many
const BATCH: usize = 10; // add/drop this many per cycle
const REFRESH_DAYS: i64 = 2; // age threshold

// selectors cached once
macro_rules! sel {
    ($s:literal) => {
        &*Lazy::new(|| Selector::parse($s).unwrap())
    };
}

async fn head_ok(url: &str) -> bool {
    CUSTOM_DNS_CLIENT
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

fn parse_article(article: scraper::element_ref::ElementRef) -> Option<DiscoveryGame> {
    let game = fetch_game_info(article);
    if !game.img.contains("imageban") {
        return None;
    }

    let mut secondary = Vec::new();
    for p in 3..=5 {
        let sel =
            Selector::parse(&format!(".entry-content > p:nth-of-type({p}) img[src]")).unwrap();
        for img_el in article.select(&sel) {
            if let Some(s) = img_el.value().attr("src") {
                secondary.push(s.to_string());
                if secondary.len() == 5 {
                    break;
                }
            }
        }
    }

    Some(DiscoveryGame {
        game_title: game.title,
        game_main_image: game.img,
        game_description: game.desc,
        game_magnetlink: game.magnetlink,
        game_torrent_paste_link: game.pastebin,
        game_secondary_images: secondary,
        game_href: game.href,
        game_tags: game.tag,
    })
}

async fn fetch_page(n: u32) -> Result<Vec<DiscoveryGame>, ScrapingError> {
    let url = format!("https://fitgirl-repacks.site/category/lossless-repack/page/{n}");
    let body = CUSTOM_DNS_CLIENT
        .get(&url)
        .send()
        .await
        .map_err(|e| ScrapingError::ReqwestError(e.to_string()))?
        .text()
        .await
        .map_err(|e| ScrapingError::ReqwestError(e.to_string()))?;

    let doc = Html::parse_document(&body);
    let mut games = Vec::new();
    for art in doc.select(sel!("article")) {
        if let Some(pg) = parse_article(art) {
            games.push(pg);
        }
    }
    Ok(games)
}

fn discovery_dir() -> std::path::PathBuf {
    directories::BaseDirs::new()
        .unwrap()
        .config_dir()
        .join("com.fitlauncher.carrotrub/tempGames/discovery")
}
fn json_path() -> std::path::PathBuf {
    discovery_dir().join("games_list.json")
}
fn meta_path() -> std::path::PathBuf {
    discovery_dir().join("games_meta.json")
}

async fn read_meta_ts() -> Option<DateTime<Utc>> {
    let bytes = fs::read(meta_path()).await.ok()?;
    serde_json::from_slice::<String>(&bytes)
        .ok()
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&Utc))
}
async fn write_meta_ts() {
    let _ = fs::write(
        meta_path(),
        serde_json::to_vec(&Utc::now().to_rfc3339()).unwrap(),
    )
    .await;
}

pub async fn get_100_games_unordered() -> Result<(), Box<ScrapingError>> {
    fs::create_dir_all(discovery_dir()).await.ok();

    let mut queue: Vec<DiscoveryGame> = if let Ok(bytes) = fs::read(json_path()).await {
        serde_json::from_slice(&bytes).unwrap_or_default()
    } else {
        Vec::new()
    };

    let too_old = match read_meta_ts().await {
        Some(ts) => Utc::now() - ts > chrono::Duration::days(REFRESH_DAYS),
        None => true,
    };

    if queue.len() >= TARGET && !too_old {
        queue.shuffle(&mut rng());
        fs::write(json_path(), serde_json::to_vec_pretty(&queue).unwrap())
            .await
            .unwrap();
        println!("cache fresh (<{REFRESH_DAYS} days) – shuffled only");
        return Ok(());
    }

    use std::collections::HashSet;
    let mut have: HashSet<String> = queue.iter().map(|g| g.game_title.clone()).collect();

    let mut page = 1;
    while queue.len() < TARGET && page <= 10 {
        let mut fresh = Vec::<DiscoveryGame>::new();

        while fresh.len() < BATCH && page <= 10 {
            let mut page_games = fetch_page(page).await?;
            for g in page_games.drain(..) {
                if have.insert(g.game_title.clone()) {
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

        for g in &mut fresh {
            g.game_secondary_images = stream::iter(g.game_secondary_images.clone())
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

        fs::write(json_path(), serde_json::to_vec_pretty(&queue).unwrap())
            .await
            .unwrap();
        println!("wrote batch, queue size now {}", queue.len());
    }

    write_meta_ts().await;
    println!("queue ready with {} games", queue.len());
    Ok(())
}
