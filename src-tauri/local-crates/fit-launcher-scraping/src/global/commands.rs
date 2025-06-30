use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use scraper::{Html, Selector};
use specta::specta;
use std::hash::{DefaultHasher, Hash, Hasher};
use tauri::Manager;
use tracing::{error, info};

use anyhow::Result;

use std::path::Path;
use std::time::Instant;

use crate::errors::ScrapingError;
use crate::global::functions::download_sitemap;
use crate::singular_game_path;
use crate::structs::Game;

#[tokio::main]
pub async fn get_sitemaps_website(
    app_handle: tauri::AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut all_files_exist = true;

    let mut binding = app_handle.path().app_data_dir().unwrap();

    binding.push("sitemaps");

    match Path::new(&binding).exists() {
        true => (),
        false => {
            tokio::fs::create_dir_all(&binding).await?;
        }
    }

    // Check for the first 5 files
    for page_number in 1..=7 {
        let relative_filename = format!("post-sitemap{}.xml", page_number);
        let concrete_path = &binding.join(relative_filename);
        if !Path::new(concrete_path).try_exists().unwrap() {
            all_files_exist = false;
            break;
        }
    }

    // If all first 5 files exist, only download the 5th file
    let range = if all_files_exist { 8..=8 } else { 1..=8 };

    // Download files as needed
    for page_number in range {
        let relative_url = format!(
            "https://fitgirl-repacks.site/post-sitemap{}.xml",
            page_number
        );
        let relative_filename = format!("post-sitemap{}", page_number);

        let my_app_handle = app_handle.clone();
        download_sitemap(my_app_handle, &relative_url, &relative_filename).await?;
    }

    Ok(())
}

#[tauri::command]
#[specta]
pub fn hash_url(url: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    hasher.finish()
}

#[tauri::command]
#[specta]
pub async fn get_singular_game_info(
    app_handle: tauri::AppHandle,
    game_link: String,
) -> Result<(), ScrapingError> {
    let start_time = Instant::now();

    let url = game_link.as_str();
    let response = CUSTOM_DNS_CLIENT.get(url).send().await.map_err(|e| {
        error!("Failed to fetch URL: {}", e);
        ScrapingError::HttpStatusCodeError(e.to_string())
    })?;

    let body = response.text().await.map_err(|e| {
        error!("Failed to read response body: {}", e);
        ScrapingError::HttpStatusCodeError(e.to_string())
    })?;

    let doc = Html::parse_document(&body);

    let title_selector = Selector::parse(".entry-title").unwrap();
    let image_selector = Selector::parse(".entry-content > p > a > img").unwrap();
    let desc_selector = Selector::parse("div.entry-content").unwrap();
    let magnet_selector = Selector::parse("a[href*='magnet']").unwrap();
    // TODO: fix tag selector
    let tag_selector = Selector::parse(".entry-content p strong:first-of-type").unwrap();

    let title = doc
        .select(&title_selector)
        .next()
        .map(|e| e.text().collect::<String>())
        .unwrap_or_default();

    let desc = doc
        .select(&desc_selector)
        .next()
        .map(|e| e.text().collect::<String>())
        .unwrap_or_default();

    let magnet = doc
        .select(&magnet_selector)
        .next()
        .and_then(|e| e.value().attr("href"))
        .unwrap_or_default()
        .to_string();

    let img = doc
        .select(&image_selector)
        .next()
        .and_then(|e| e.value().attr("src"))
        .unwrap_or_default()
        .to_string();

    let tag = doc
        .select(&tag_selector)
        .next()
        .map(|e| e.text().collect::<String>())
        .unwrap_or_else(|| "Unknown".to_string());

    let game = Game {
        title,
        img,
        desc,
        magnetlink: magnet,
        href: url.to_string(),
        tag,
        pastebin: String::new(),
    };
    let hash = hash_url(url);
    let filename = format!("singular_game_{}.json", hash);
    let path = singular_game_path(&app_handle, &filename);

    let json = serde_json::to_string_pretty(&game).map_err(|e| {
        error!("Failed to serialize game JSON: {}", e);
        ScrapingError::FileJSONError(e.to_string())
    })?;

    tokio::fs::write(&path, json).await.map_err(|e| {
        error!("Failed to write game to file: {}", e);
        ScrapingError::IOError(e.to_string())
    })?;

    info!(
        "Game data written to singular_game_{}.json in {:#?}",
        hash,
        start_time.elapsed()
    );

    Ok(())
}
