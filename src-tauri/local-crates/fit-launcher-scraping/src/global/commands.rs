use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use scraper::Html;
use specta::specta;
use tauri::Manager;
use tracing::{error, info};

use anyhow::Result;

use std::path::Path;
use std::time::Instant;

use crate::errors::ScrapingError;
use crate::global::functions::download_sitemap;
use crate::global::functions::helper::fetch_game_info;
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
        let relative_filename = format!("post-sitemap{page_number}.xml");
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
        let relative_url = format!("https://fitgirl-repacks.site/post-sitemap{page_number}.xml");
        let relative_filename = format!("post-sitemap{page_number}");

        let my_app_handle = app_handle.clone();
        download_sitemap(my_app_handle, &relative_url, &relative_filename).await?;
    }

    Ok(())
}

#[tauri::command]
#[specta]
pub fn hash_url(url: &str) -> String {
    let hasher = ahash::RandomState::with_seeds(0x1A, 0x6B, 0x4D, 0xF6);
    let hash = hasher.hash_one(url);
    format!("{hash:016x}")
}

#[tauri::command]
#[specta]
pub async fn get_singular_game_info(
    app_handle: tauri::AppHandle,
    game_link: String,
) -> Result<(), ScrapingError> {
    use std::time::{Duration, SystemTime};
    use tokio::fs;
    use tokio::io::AsyncWriteExt;

    let start_time = Instant::now();
    let url = game_link.clone();
    let hash = hash_url(&url);
    let filename = format!("singular_game_{hash}.json");
    let path = singular_game_path(&app_handle, &filename);

    let cache_dir = singular_game_path(&app_handle, "");
    if let Ok(mut entries) = fs::read_dir(&cache_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let file_name = entry.file_name();
            if file_name.to_string_lossy().starts_with("singular_game_") {
                if let Ok(metadata) = entry.metadata().await {
                    if let Ok(modified) = metadata.modified() {
                        if SystemTime::now()
                            .duration_since(modified)
                            .unwrap_or_default()
                            > Duration::from_secs(60 * 60 * 24)
                        {
                            let _ = fs::remove_file(entry.path()).await;
                        }
                    }
                }
            }
        }
    }

    if path.exists() {
        if let Ok(metadata) = fs::metadata(&path).await {
            if let Ok(modified) = metadata.modified() {
                if SystemTime::now()
                    .duration_since(modified)
                    .unwrap_or_default()
                    < Duration::from_secs(60 * 60 * 24)
                {
                    info!("Using cached game info for {}", hash);
                    return Ok(());
                }
            }
        }
    }

    let response = CUSTOM_DNS_CLIENT
        .read()
        .await
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            error!("Failed to fetch URL: {}", e);
            ScrapingError::HttpStatusCodeError(e.to_string())
        })?;

    let body = response.text().await.map_err(|e| {
        error!("Failed to read response body: {}", e);
        ScrapingError::HttpStatusCodeError(e.to_string())
    })?;

    let game = tokio::task::spawn_blocking(move || -> Result<Game, ScrapingError> {
        let doc = Html::parse_document(&body);
        let article = doc
            .select(&scraper::Selector::parse("article").unwrap())
            .next()
            .ok_or(ScrapingError::ArticleNotFound(game_link))?;
        Ok(fetch_game_info(article))
    })
    .await
    .unwrap()?;

    let json = serde_json::to_string_pretty(&game).map_err(|e| {
        error!("Failed to serialize game JSON: {}", e);
        ScrapingError::FileJSONError(e.to_string())
    })?;

    let mut file = fs::File::create(&path).await.map_err(|e| {
        error!("Failed to create game file: {}", e);
        ScrapingError::IOError(e.to_string())
    })?;
    file.write_all(json.as_bytes()).await.map_err(|e| {
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
