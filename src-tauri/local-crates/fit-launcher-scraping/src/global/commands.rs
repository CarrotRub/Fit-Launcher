use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use scraper::Html;
use specta::specta;
use std::error::Error;
use tauri::{AppHandle, Manager};
use tracing::{error, info};

use anyhow::Result;

use crate::errors::ScrapingError;
use crate::global::functions::download_sitemap;
use crate::global::functions::helper::fetch_game_info;
use crate::search_index::{
    SearchIndex, SearchIndexEntry, build_search_index, get_search_index_path,
};
use crate::singular_game_path;
use crate::structs::Game;
use futures::future::join_all;
use regex::Regex;
use reqwest::Client;
use std::path::{Path, PathBuf};
use std::time::Instant;
use thiserror::Error;
use tokio::sync::AcquireError;
use tokio::{fs, task};

const BASE_URL: &str = "https://fitgirl-repacks.site/sitemap_index.xml";
const MAX_CONCURRENT: usize = 4;

pub async fn get_sitemaps_website(app_handle: AppHandle) -> Result<(), SitemapError> {
    let client = Client::new();
    let sitemap_index = client.get(BASE_URL).send().await?.text().await?;

    let re = Regex::new(r"https://fitgirl-repacks\.site/post-sitemap(?:\d*)\.xml")?;
    let mut urls: Vec<String> = re
        .find_iter(&sitemap_index)
        .map(|m| m.as_str().to_string())
        .collect();

    urls.sort();
    urls.dedup();

    if urls.is_empty() {
        tracing::warn!("No post-sitemap entries found in sitemap_index.xml");
        return Ok(());
    }

    let sitemaps_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir")
        .join("sitemaps");

    fs::create_dir_all(&sitemaps_dir).await?;

    let max_number = urls
        .iter()
        .filter_map(|url| {
            let re_num = Regex::new(r"post-sitemap(\d*)\.xml").unwrap();
            re_num
                .captures(url)
                .and_then(|cap| cap.get(1))
                .and_then(|m| {
                    if m.as_str().is_empty() {
                        Some(1)
                    } else {
                        m.as_str().parse::<usize>().ok()
                    }
                })
        })
        .max()
        .unwrap_or(1);

    let largest_sitemap = format!("post-sitemap{}.xml", max_number);
    let largest_path = sitemaps_dir.join(&largest_sitemap);

    if !largest_path.exists() {
        tracing::warn!(
            "Largest sitemap {} missing. Clearing all sitemaps and redownloading...",
            largest_sitemap
        );

        if let Ok(mut entries) = fs::read_dir(&sitemaps_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let _ = fs::remove_file(entry.path()).await;
            }
        }
    }

    let check_tasks = urls.iter().map(|url| {
        let filename = extract_filename(url);
        let path = sitemaps_dir.join(&filename);
        task::spawn(async move { fs::try_exists(&path).await.unwrap_or(false) })
    });
    let existing = join_all(check_tasks).await;

    let to_download: Vec<_> = urls
        .into_iter()
        .zip(existing)
        .filter_map(|(url, exists)| match exists {
            Ok(true) => None,
            _ => Some(url),
        })
        .collect();

    if to_download.is_empty() {
        tracing::info!("All sitemap files already up to date");
        return Ok(());
    }

    tracing::info!("Downloading {} missing sitemaps", to_download.len());

    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT));
    let mut tasks = Vec::new();

    for url in to_download {
        let filename = extract_filename(&url);
        let dest_path = sitemaps_dir.join(&filename);

        let client = client.clone();
        let permit = sem.clone().acquire_owned().await?;

        tasks.push(task::spawn(async move {
            let _permit = permit;
            match download_sitemap_file(&client, &url, &dest_path).await {
                Ok(_) => tracing::info!("Downloaded {filename}"),
                Err(e) => tracing::error!("Failed {filename}: {e}"),
            }
        }));
    }

    join_all(tasks).await;
    Ok(())
}

fn extract_filename(url: &str) -> String {
    url.split('/')
        .next_back()
        .unwrap_or("unknown.xml")
        .to_string()
}

async fn download_sitemap_file(
    client: &reqwest::Client,
    url: &str,
    dest_path: &PathBuf,
) -> Result<(), Box<dyn Error>> {
    let data = client.get(url).send().await?.bytes().await?;
    fs::write(dest_path, &data).await?;
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
            if file_name.to_string_lossy().starts_with("singular_game_")
                && let Ok(metadata) = entry.metadata().await
                && let Ok(modified) = metadata.modified()
                && SystemTime::now()
                    .duration_since(modified)
                    .unwrap_or_default()
                    > Duration::from_secs(60 * 60 * 24)
            {
                let _ = fs::remove_file(entry.path()).await;
            }
        }
    }

    if path.exists()
        && let Ok(metadata) = fs::metadata(&path).await
        && let Ok(modified) = metadata.modified()
        && SystemTime::now()
            .duration_since(modified)
            .unwrap_or_default()
            < Duration::from_secs(60 * 60 * 24)
    {
        info!("Using cached game info for {}", hash);
        return Ok(());
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

#[tauri::command]
#[specta]
pub async fn rebuild_search_index(app_handle: AppHandle) -> Result<(), ScrapingError> {
    build_search_index(&app_handle).await
}

#[tauri::command]
#[specta]
pub fn get_search_index_path_cmd(app_handle: AppHandle) -> String {
    get_search_index_path(&app_handle)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
#[specta]
pub async fn query_search_index(
    app_handle: AppHandle,
    query: String,
) -> Result<Vec<SearchIndexEntry>, ScrapingError> {
    use tokio::fs;

    let index_path = get_search_index_path(&app_handle);

    if !index_path.exists() {
        return Err(ScrapingError::IOError(format!(
            "Search index not found at {}",
            index_path.display()
        )));
    }

    let content = fs::read_to_string(&index_path)
        .await
        .map_err(|e| ScrapingError::IOError(format!("Failed to read search index: {}", e)))?;

    let index: SearchIndex = serde_json::from_str(&content).map_err(|e| {
        ScrapingError::FileJSONError(format!("Failed to parse search index: {}", e))
    })?;

    let query_lower = query.to_lowercase();
    let filtered: Vec<SearchIndexEntry> = index
        .into_iter()
        .filter(|entry| {
            entry.title.to_lowercase().contains(&query_lower)
                || entry.slug.to_lowercase().contains(&query_lower)
        })
        .take(25)
        .collect();

    Ok(filtered)
}

#[derive(Debug, Error)]
pub enum SitemapError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Regex error: {0}")]
    Regex(#[from] regex::Error),

    #[error("Filesystem error: {0}")]
    Io(#[from] std::io::Error),

    #[error("App data directory missing")]
    AppDataDirMissing,

    #[error("Semaphore error: {0}")]
    SemaphorePermit(#[from] AcquireError),
}
