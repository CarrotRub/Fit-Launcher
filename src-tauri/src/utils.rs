use std::{
    collections::HashMap,
    error::Error,
    fmt,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};

use anyhow::Result;
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::future::join_all;
use lru::LruCache;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use specta::{specta, Type};
use tauri::{Manager, State, Window};
use tokio::sync::Mutex;
use tracing::{info, warn};
// Define a shared boolean flag
static STOP_FLAG: AtomicBool = AtomicBool::new(false);

#[derive(Clone, serde::Serialize, Type)]
pub struct Payload {
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
struct Game {
    title: String,
    img: String,
    desc: String,
    magnetlink: String,
    href: String,
}

/// Helper function.
async fn check_url_status(url: &str) -> anyhow::Result<bool> {
    let response = CUSTOM_DNS_CLIENT.head(url).send().await.unwrap();
    Ok(response.status().is_success())
}

fn parse_image_links(body: &str, start: usize) -> anyhow::Result<Vec<String>> {
    let document = Html::parse_document(body);
    let mut images = Vec::new();

    for p_index in start..=5 {
        let selector = Selector::parse(&format!(
            ".entry-content > p:nth-of-type({}) img[src]",
            p_index
        ))
        .map_err(|_| anyhow::anyhow!("Invalid CSS selector for paragraph {}", p_index))?;

        for element in document.select(&selector) {
            if let Some(src) = element.value().attr("src") {
                images.push(src.to_string());
            }

            if images.len() >= 5 {
                return Ok(images); // Stop once we collect 5 images
            }
        }
    }

    Ok(images)
}

async fn process_image_link(src_link: String) -> anyhow::Result<String> {
    if src_link.contains("jpg.240p.") {
        let primary_image = src_link.replace("240p", "1080p");
        if check_url_status(&primary_image).await.unwrap_or(false) {
            return Ok(primary_image);
        }

        let fallback_image = primary_image.replace("jpg.1080p.", "");
        if check_url_status(&fallback_image).await.unwrap_or(false) {
            return Ok(fallback_image);
        }
    }

    Err(anyhow::anyhow!("No valid image found for {}", src_link))
}

async fn fetch_image_links(body: &str) -> anyhow::Result<Vec<String>> {
    let initial_images = parse_image_links(body, 3)?;

    // Spawn tasks for each image processing
    let tasks: Vec<_> = initial_images
        .into_iter()
        .map(|img_link| {
            tokio::task::spawn(async move {
                match process_image_link(img_link).await {
                    Ok(img) => Some(img),
                    Err(_) => None,
                }
            })
        })
        .collect();

    let results = join_all(tasks).await;

    // Collect successful, non-None results
    let mut processed = Vec::new();
    results.into_iter().for_each(|res| {
        if let Ok(Some(img)) = res {
            processed.push(img);
        }
    });

    Ok(processed)
}

async fn scrape_image_srcs(url: &str) -> Result<Vec<String>> {
    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let body = CUSTOM_DNS_CLIENT.get(url).send().await?.text().await?;
    let images = fetch_image_links(&body).await?;

    Ok(images)
}

// Cache with a capacity of 100
type ImageCache = Arc<Mutex<LruCache<String, Vec<String>>>>;

#[tauri::command]
#[specta]
pub async fn stop_get_games_images() {
    STOP_FLAG.store(true, Ordering::Relaxed);
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedGameImages {
    game_link: String,
    images: Vec<String>,
}

#[tauri::command]
#[specta]
pub async fn get_games_images(
    app_handle: tauri::AppHandle,
    game_link: String,
    image_cache: State<'_, ImageCache>,
) -> Result<(), CustomError> {
    let now = Instant::now();

    let cache_file_path = app_handle
        .path()
        .app_cache_dir()
        .unwrap_or_default()
        .join("image_cache.json");

    // Acquire the lock and merge cache from file
    let mut cache = image_cache.lock().await;
    merge_cache_from_file(&cache_file_path, &mut cache).await?;

    // Check if the game link is already cached
    if let Some(image_list) = cache.get(&game_link) {
        if !image_list.is_empty() {
            // Images already exist in cache, no need to fetch
            return Ok(());
        }
        warn!(
            "The list of {} is empty, it will get images again",
            &game_link
        );
    }

    drop(cache); // Release lock before performing network operations

    // Fetch image sources
    let image_srcs = scrape_image_srcs(&game_link).await?;

    // Save fetched data back to the cache
    let mut cache = image_cache.lock().await;
    cache.put(game_link.clone(), image_srcs.clone());
    save_cache_to_file(&cache_file_path, &cache).await?;

    info!("Time elapsed to find images: {:?}", now.elapsed());

    Ok(())
}

async fn merge_cache_from_file(
    cache_file_path: &Path,
    cache: &mut LruCache<String, Vec<String>>,
) -> Result<()> {
    if let Ok(data) = tokio::fs::read_to_string(cache_file_path).await {
        if let Ok(loaded_cache) = serde_json::from_str::<HashMap<String, Vec<String>>>(&data) {
            for (key, value) in loaded_cache {
                cache.put(key, value);
            }
        }
    }
    Ok(())
}

async fn save_cache_to_file(
    cache_file_path: &Path,
    cache: &LruCache<String, Vec<String>>,
) -> Result<()> {
    let cache_as_hashmap: HashMap<String, Vec<String>> =
        cache.iter().map(|(k, v)| (k.clone(), v.clone())).collect();

    let cache_data = serde_json::to_string_pretty(&cache_as_hashmap)
        .map_err(|e| anyhow::anyhow!("Failed to serialize cache: {}", e))?;

    tokio::fs::write(cache_file_path, cache_data)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to write cache to file: {}", e))?;

    Ok(())
}
//Always serialize returns...
#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    content: String,
}

#[derive(Debug, Serialize, Type)]
pub struct CustomError {
    message: String,
}

impl fmt::Display for CustomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl Error for CustomError {}

impl From<Box<dyn Error>> for CustomError {
    fn from(error: Box<dyn Error>) -> Self {
        CustomError {
            message: error.to_string(),
        }
    }
}

impl From<anyhow::Error> for CustomError {
    fn from(error: anyhow::Error) -> Self {
        CustomError {
            message: error.to_string(),
        }
    }
}

impl From<std::io::Error> for CustomError {
    fn from(error: std::io::Error) -> Self {
        CustomError {
            message: error.to_string(),
        }
    }
}

#[tauri::command]
#[specta]
pub async fn close_splashscreen(window: Window) {
    // Close splashscreen
    window
        .get_webview_window("splashscreen")
        .expect("no window labeled 'splashscreen' found")
        .close()
        .unwrap();
    // Show main window
    window
        .get_webview_window("main")
        .expect("no window labeled 'main' found")
        .show()
        .unwrap();
}
