use anyhow::Result;
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::StreamExt;
use lru::LruCache;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::{
    collections::HashMap,
    error::Error,
    fmt,
    path::Path,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Instant,
};
use tauri::{AppHandle, Emitter, Manager, State, Window};
use tauri_specta::Event;
use tokio::sync::Mutex;
use tracing::{info, warn};
// Define a shared boolean flag
static STOP_FLAG: AtomicBool = AtomicBool::new(false);

#[derive(Clone, serde::Serialize, Type)]
pub struct Payload {
    pub message: String,
}

/// Payload for progressive image loading events
#[derive(Clone, Serialize, Type, Event)]
pub struct GameImageReadyPayload {
    pub game_link: String,
    pub image_url: String,
    pub index: usize,
    pub total: usize,
}

/// Helper function.
async fn check_url_status(url: &str) -> anyhow::Result<bool> {
    let response = CUSTOM_DNS_CLIENT.read().await.head(url).send().await?;
    Ok(response.status().is_success())
}

fn parse_image_links(body: &str, start: usize) -> anyhow::Result<Vec<String>> {
    let document = Html::parse_document(body);
    let mut images = Vec::new();

    for p_index in start..=6 {
        let selector =
            Selector::parse(&format!(".entry-content p:nth-of-type({p_index}) img[src]"))
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

async fn process_image_link(src_link: String) -> Option<String> {
    if !src_link.contains("jpg.240p.") {
        return None;
    }

    let primary_image = src_link.replace("240p", "1080p");
    let fallback_image = primary_image.replace("jpg.1080p.", "");

    let candidates = vec![primary_image, fallback_image];

    let valid_urls: Vec<_> = futures::stream::iter(candidates)
        .map(|url| async move {
            if check_url_status(&url).await.unwrap_or(false) {
                Some(url)
            } else {
                None
            }
        })
        .buffer_unordered(2)
        .filter_map(|x| async move { x })
        .collect()
        .await;

    valid_urls
        .first()
        .map(|url| format!("https://wsrv.nl/?url={}&w=1000&q=80&output=webp", url))
}

async fn scrape_and_emit_images(app_handle: &AppHandle, game_link: &str) -> Result<Vec<String>> {
    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let body = CUSTOM_DNS_CLIENT
        .read()
        .await
        .get(game_link)
        .send()
        .await?
        .text()
        .await?;

    let initial_images = parse_image_links(&body, 3)?;
    let total = initial_images.len();

    // Process each image and emit events as they complete for UX
    let processed_images = futures::stream::iter(initial_images.into_iter().enumerate())
        .map(|(index, img_link)| {
            let app_handle = app_handle.clone();
            let game_link = game_link.to_string();

            async move {
                if let Some(url) = process_image_link(img_link).await {
                    let _ = app_handle.emit(
                        "game_images::image_ready",
                        GameImageReadyPayload {
                            game_link,
                            image_url: url.clone(),
                            index,
                            total,
                        },
                    );
                    Some(url)
                } else {
                    None
                }
            }
        })
        .buffer_unordered(4)
        .filter_map(|x| async move { x })
        .collect::<Vec<_>>()
        .await;

    Ok(processed_images)
}

// Cache with a capacity of 100
type ImageCache = Arc<Mutex<LruCache<String, Vec<String>>>>;

#[tauri::command]
#[specta]
pub async fn stop_get_games_images() {
    STOP_FLAG.store(true, Ordering::Relaxed);
}

#[tauri::command]
#[specta]
pub async fn get_games_images(
    app_handle: tauri::AppHandle,
    game_link: String,
    image_cache: State<'_, ImageCache>,
) -> Result<Vec<String>, CustomError> {
    let start = Instant::now();

    let cache_file_path = app_handle
        .path()
        .app_cache_dir()
        .unwrap_or_default()
        .join("game_images_cache.json");

    {
        let mut cache = image_cache.lock().await;
        merge_cache_from_file(&cache_file_path, &mut cache).await?;

        if let Some(image_list) = cache.get(&game_link) {
            if !image_list.is_empty() {
                return Ok(image_list.clone());
            }
            warn!(
                "Cached list for '{}' is empty. Fetching anew...",
                &game_link
            );
        }
    }

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Scraping cancelled").into());
    }

    // Fetch images with progressive emission
    let image_srcs = scrape_and_emit_images(&app_handle, &game_link).await?;

    {
        let mut cache = image_cache.lock().await;
        cache.put(game_link.clone(), image_srcs.clone());

        let cache_snapshot = cache.clone();
        let path = cache_file_path.clone();
        tokio::spawn(async move {
            let _ = save_cache_to_file(&path, &cache_snapshot).await;
        });
    }

    info!("Image fetch completed in {:?}", start.elapsed());
    Ok(image_srcs)
}

async fn merge_cache_from_file(
    cache_file_path: &Path,
    cache: &mut LruCache<String, Vec<String>>,
) -> Result<()> {
    if let Ok(data) = tokio::fs::read_to_string(cache_file_path).await
        && let Ok(loaded_cache) = serde_json::from_str::<HashMap<String, Vec<String>>>(&data)
    {
        for (key, value) in loaded_cache {
            cache.put(key, value);
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

#[tauri::command]
#[specta]
pub fn open_devtools(app: AppHandle) {
    let webview_window = app.get_webview_window("main").unwrap();
    webview_window.open_devtools();
}
#[tauri::command]
#[specta]
pub fn get_install_queue_status()
-> Result<fit_launcher_ui_automation::controller_manager::QueueStatus, CustomError> {
    fit_launcher_ui_automation::controller_manager::get_install_queue_status()
        .map_err(|e| CustomError { message: e })
}

#[tauri::command]
#[specta]
pub fn is_controller_running() -> bool {
    #[cfg(windows)]
    {
        fit_launcher_ui_automation::controller_manager::ControllerManager::global().is_running()
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
#[specta]
pub fn quit_app() {
    use std::sync::atomic::Ordering;

    info!("quit_app called - setting QUITTING flag and exiting...");
    crate::bootstrap::tray::QUITTING.store(true, Ordering::Release);
    std::process::exit(0);
}
