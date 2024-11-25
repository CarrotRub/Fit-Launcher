// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// TODO: Add updater.

mod scrapingfunc;
pub use crate::scrapingfunc::basic_scraping;
pub use crate::scrapingfunc::commands_scraping;

mod torrentfunc;
pub use crate::torrentfunc::torrent_commands;

mod custom_ui_automation;
pub use crate::custom_ui_automation::executable_custom_commands;

mod mighty;
use std::collections::HashMap;
use std::fs;

mod image_colors;
pub use crate::image_colors::dominant_colors;

use scraper::{Html, Selector};
use serde_json::Value;
use std::error::Error;
use tracing::error;
use tracing::info;
use tracing::warn;

use core::str;
use tauri::api::path::app_log_dir;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::fs::File;
use std::io::Read;

use tauri::{Manager, Window};

use std::path::PathBuf;
use std::time::Instant;
use tauri::async_runtime::spawn;

use tracing_appender::non_blocking::WorkerGuard;

// use serde_json::json;
use std::path::Path;
// crates for requests
use anyhow::Result;
// stop threads
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
// stop threads
// caching
use lru::LruCache;
use std::num::NonZeroUsize;
use tauri::State;
use tokio::sync::Mutex;

use futures::stream::{self, StreamExt};
use tokio::task;

use chrono::Utc;

// Define a shared boolean flag
static STOP_FLAG: AtomicBool = AtomicBool::new(false);
static PAUSE_FLAG: AtomicBool = AtomicBool::new(false);

#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Game {
    title: String,
    img: String,
    desc: String,
    magnetlink: String,
    href: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SingleGame {
    my_all_images: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GameImages {
    my_all_images: Vec<String>,
}

/// Helper function.
async fn check_url_status(client: &Client, url: &str) -> Result<bool> {
    let response = client.head(url).send().await?;
    Ok(response.status().is_success())
}

fn parse_image_links(body: &str) -> Result<Vec<String>> {
    let document = Html::parse_document(body);
    let mut images = Vec::new();

    // Iterate over relevant paragraphs
    for p_index in 3..10 {
        let href_selector_str = format!(".entry-content > p:nth-of-type({}) img[src]", p_index);
        let href_selector = Selector::parse(&href_selector_str)
            .map_err(|_| anyhow::anyhow!("Failed to parse selector"))?;

        for element in document.select(&href_selector) {
            if let Some(src_link) = element.value().attr("src") {
                images.push(src_link.to_string());
            }
        }
    }
    Ok(images)
}

async fn fetch_image_links(client: Arc<Client>, body: &str) -> Result<Vec<String>> {
    let initial_images = parse_image_links(body)?;
    let client = Arc::clone(&client);

    let images = stream::iter(initial_images)
        .map(|src_link| {
            let client = Arc::clone(&client);
            task::spawn(async move {
                if src_link.contains("jpg.240p.") {
                    let primary_image = src_link.replace("240p", "1080p");
                    if check_url_status(&client, &primary_image).await? {
                        Ok::<Option<String>, anyhow::Error>(Some(primary_image))
                    } else {
                        let fallback_image = primary_image.replace("jpg.1080p.", "");
                        if check_url_status(&client, &fallback_image).await? {
                            Ok(Some(fallback_image))
                        } else {
                            Ok(None)
                        }
                    }
                } else {
                    Ok(None)
                }
            })
        })
        .buffer_unordered(10)
        .map(|result| match result {
            Ok(Ok(Some(image))) => Ok(image),
            Ok(Ok(None)) => Err(anyhow::anyhow!("Image not found")),
            Ok(Err(e)) => Err(anyhow::anyhow!("Error fetching image: {}", e)),
            Err(join_err) => Err(anyhow::anyhow!("Join error: {}", join_err)),
        })
        .filter_map(|result| async move { result.ok() }) // Collects only the successful results
        .collect::<Vec<_>>() // Collects into Vec<String>
        .await;

    Ok(images)
}

async fn scrape_image_srcs(url: &str) -> Result<Vec<String>> {
    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let client = Arc::new(Client::new());
    let body = client.get(url).send().await?.text().await?;
    let images = fetch_image_links(client, &body).await?;

    Ok(images)
}

// Cache with a capacity of 100
type ImageCache = Arc<Mutex<LruCache<String, Vec<String>>>>;

#[tauri::command]
async fn stop_get_games_images() {
    STOP_FLAG.store(true, Ordering::Relaxed);
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedGameImages {
    game_link: String,
    images: Vec<String>,
}

// TODO: Add notify crate to watch a file for changes without resorting to a performance-draining loop.

#[tauri::command]
async fn get_games_images(
    app_handle: tauri::AppHandle,
    game_link: String,
    image_cache: State<'_, ImageCache>,
) -> Result<(), CustomError> {
    let now = Instant::now();
    STOP_FLAG.store(false, Ordering::Relaxed);

    let mut cache_file_path = app_handle.path_resolver().app_cache_dir().unwrap();
    cache_file_path.push("image_cache.json");

    let mut cache = image_cache.lock().await;

    // Load and merge cache if exists
    if let Ok(data) = tokio::fs::read_to_string(&cache_file_path).await {
        if let Ok(loaded_cache) = serde_json::from_str::<HashMap<String, Vec<String>>>(&data) {
            for (key, value) in loaded_cache {
                cache.put(key, value);
            }
        }
    }

    if let Some(cached_images) = cache.get(&game_link) {
        return Ok(());
    }

    drop(cache); // Release lock before network operation

    let image_srcs = scrape_image_srcs(&game_link).await?;

    let mut cache = image_cache.lock().await;
    cache.put(game_link.clone(), image_srcs.clone());

    // Save cache to file
    let cache_as_hashmap: HashMap<String, Vec<String>> =
        cache.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
    let updated_cache_data =
        serde_json::to_string_pretty(&cache_as_hashmap).map_err(|e| CustomError {
            message: e.to_string(),
        })?;
    tokio::fs::write(&cache_file_path, updated_cache_data).await?;

    info!("Time elapsed to find images : {:#?}", now.elapsed());

    Ok(())
}

//Always serialize returns...
#[derive(Debug, Serialize, Deserialize)]
struct FileContent {
    content: String,
}

#[derive(Debug, Serialize)]
struct CustomError {
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

#[tauri::command(async)]
async fn read_file(file_path: String) -> Result<FileContent, CustomError> {
    let mut file = File::open(&file_path).map_err(|e| CustomError {
        message: e.to_string(),
    })?;
    let mut data_content = String::new();
    file.read_to_string(&mut data_content)
        .map_err(|e| CustomError {
            message: e.to_string(),
        })?;

    Ok(FileContent {
        content: data_content,
    })
}

#[tauri::command]
async fn clear_file(file_path: String) -> Result<(), CustomError> {
    let path = Path::new(&file_path);

    // Attempt to create the file, truncating if it already exists
    File::create(path).map_err(|err| CustomError {
        message: err.to_string(),
    })?;

    Ok(())
}

#[tauri::command]
async fn close_splashscreen(window: Window) {
    // Close splashscreen
    window
        .get_window("splashscreen")
        .expect("no window labeled 'splashscreen' found")
        .close()
        .unwrap();
    // Show main window
    window
        .get_window("main")
        .expect("no window labeled 'main' found")
        .show()
        .unwrap();
}

#[tauri::command]
fn check_folder_path(path: String) -> Result<bool, bool> {
    let path_obj = PathBuf::from(&path);

    // Debugging information
    info!("Checking path: {:?}", path_obj);

    if !path_obj.exists() {
        warn!("Path does not exist.");
        return Ok(false);
    }
    if !path_obj.is_dir() {
        warn!("Path is not a directory.");
        return Ok(false);
    }
    info!("Path is valid.");
    Ok(true)
}

fn delete_invalid_json_files(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn Error>> {
    let mut dir_path = app_handle.path_resolver().app_data_dir().unwrap();
    dir_path.push("tempGames");

    if !dir_path.exists() {
        info!("Directory does not exist: {:?}", dir_path);
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Directory not found",
        )));
    }

    // Read the folder and iterate over the files
    for entry in fs::read_dir(dir_path)? {
        let entry = entry?;
        let path = entry.path();

        // Only process JSON files
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Err(e) = check_file_for_tags(&path) {
                error!("Error processing file {:?}: {}", path, e);
            }
        }
    }

    Ok(())
}

// Function to check a single JSON file for the "tag" key in each object
fn check_file_for_tags(path: &Path) -> Result<()> {
    // Read the file content as a string
    let file_content = fs::read_to_string(path)?;

    // Parse the JSON content into a Value object
    let json: Value = serde_json::from_str(&file_content)?;

    // Ensure the JSON is an array of objects
    if let Some(arr) = json.as_array() {
        for obj in arr {
            // Each object should contain the "tag" key
            if obj.get("tag").is_none() {
                warn!("Missing 'tag' key in file: {:?}, rebuilding...", path);
                fs::remove_file(path)?;
            }
        }
    }

    Ok(())
}

fn setup_logging(logs_dir: PathBuf) -> WorkerGuard {
    let file_appender = tracing_appender::rolling::never(logs_dir, "app.log");
    let (file_writer, guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::fmt()
        .with_writer(file_writer)
        .with_ansi(false)
        .with_max_level(tracing::Level::INFO)
        .init();

    guard
}

// Function to perform a network request after ensuring frontend is ready, and emit network-failure if the request fails
async fn perform_network_request(app_handle: tauri::AppHandle) {
    info!(
        "perform_network_request: Waiting for frontend-ready before starting the network request."
    );

    // Get the main window to listen for 'frontend-ready'
    if let Some(main_window) = app_handle.get_window("main") {
        // Clone `app_handle` so it can be moved into both closures
        let app_handle_clone = app_handle.clone();

        // Listen for 'frontend-ready' before performing the network request
        main_window.listen("frontend-ready", move |_| {
            info!("Frontend is ready, starting the network request...");

            // Clone `app_handle_clone` for use in the async block
            let app_handle_inner_clone = app_handle_clone.clone();

            // Perform the network request directly to the site - This is lazy but it works for now!
            //TODO: improve this
            spawn(async move {
                let result = reqwest::get("https://fitgirl-repacks.site").await;

                // Check if the request was successful
                match result {
                    Ok(resp) => {
                        let _text = resp.text().await.unwrap();
                        info!(
                            "perform_network_request: Network request to Fitgirl website was successful."
                        );
                    }
                    Err(_) => {
                        info!("Network request failed, emitting network-failure event.");

                        // Emit the network-failure event after the network request fails
                        let failure_message = Payload {
                            message: "There was a network issue, unable to retrieve latest game data. (E01)".to_string(),
                        };
                        app_handle_inner_clone
                            .emit_all("network-failure", failure_message)
                            .unwrap();
                    }
                }
            });
        });
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    info!(
        "{}: Main.rs: Starting the application...",
        Utc::now().format("%a,%b,%e,%T,%Y")
    );
    let image_cache = Arc::new(Mutex::new(LruCache::<String, Vec<String>>::new(
        NonZeroUsize::new(30).unwrap(),
    )));
    let context = tauri::generate_context!();

    let logs_dir = app_log_dir(context.config()).unwrap();
    info!("path to logs : {:#?}", &logs_dir);
    let _log_guard = setup_logging(logs_dir);

    tauri::Builder
        ::default()
        .setup(|app| {
            let splashscreen_window = app.get_window("splashscreen").unwrap();
            let main_window = app.get_window("main").unwrap();
            let current_app_handle = app.app_handle().clone();

            let app_handle = app.handle().clone();

            let scraping_failed_event = app_handle.clone();

            // Delete JSON files missing the 'tag' field or corrupted and log the process
            if let Err(e) = delete_invalid_json_files(&current_app_handle) {
                eprintln!(
                    "Error during deletion of invalid or corrupted JSON files: {}",
                    e
                );
            }

            // Perform the network request
            spawn(async move {
                perform_network_request(app_handle).await;
            });

            // Clone the app handle for use in async tasks
            let first_app_handle = current_app_handle.clone();
            let second_app_handle = current_app_handle.clone();
            let third_app_handle = current_app_handle.clone();
            let fourth_app_handle = current_app_handle.clone();

            // Perform asynchronous initialization tasks without blocking the main thread
            tauri::async_runtime::spawn(async move {
                tracing::info!("Starting async tasks");

                let mandatory_tasks_online = tauri::async_runtime::spawn_blocking(move || {
                    // Clone before emitting to avoid moving the handle
                    let first_app_handle_clone = first_app_handle.clone();
                    if let Err(e) = basic_scraping::scraping_func(first_app_handle_clone.clone()) {
                        eprintln!("Error in scraping_func: {}", e);
                        tracing::info!("Error in scraping_func: {}", e);
                        // Do not exit, continue running
                    } else {
                        tracing::info!(
                            "[scraping_func] has been completed. No errors are reported."
                        );
                        //TODO: This will be used to emit a signal to the frontend that the scraping is complete and for all other app_handle.
                        // when the main reload window code is removed
                        first_app_handle_clone.emit_all("new-games-ready", {}).unwrap();
                    }

                    // Clone before emitting to avoid moving the handle
                    let second_app_handle_clone = second_app_handle.clone();
                    if
                        let Err(e) = basic_scraping::popular_games_scraping_func(
                            second_app_handle_clone.clone()
                        )
                    {
                        eprintln!("Error in popular_games_scraping_func: {}", e);
                        tracing::info!("Error in popular_games_scraping_func: {}", e);
                        // Do not exit, continue running
                    } else {
                        tracing::info!(
                            "[popular_games_scraping_func] has been completed. No errors are reported."
                        );
                        // when the main reload window code is removed
                        second_app_handle_clone.emit_all("popular-games-ready", {}).unwrap();
                    }

                    // Clone before emitting to avoid moving the handle
                    let third_app_handle_clone = third_app_handle.clone();
                    if
                        let Err(e) = basic_scraping::recently_updated_games_scraping_func(
                            third_app_handle_clone.clone()
                        )
                    {
                        eprintln!("Error in recently_updated_games_scraping_func: {}", e);
                        tracing::info!("Error in recently_updated_games_scraping_func: {}", e);
                        // Do not exit, continue running
                    } else {
                        tracing::info!(
                            "[recently_updated_games_scraping_func] has been completed. No errors are reported."
                        );
                        // when the main reload window code is removed
                        third_app_handle_clone.emit_all("recent-updated-games-ready", {}).unwrap();
                    }

                    // Clone before emitting to avoid moving the handle
                    let fourth_app_handle_clone = fourth_app_handle.clone();
                    if
                        let Err(e) = commands_scraping::get_sitemaps_website(
                            fourth_app_handle_clone.clone()
                        )
                    {
                        eprintln!("Error in get_sitemaps_website: {}", e);
                        tracing::info!("Error in get_sitemaps_website: {}", e);
                        // Do not exit, continue running
                    } else {
                        tracing::info!(
                            "[get_sitemaps_website] has been completed. No errors are reported."
                        );
                        // when the main reload window code is removed
                        fourth_app_handle_clone.emit_all("sitemaps-ready", {}).unwrap();
                    }
                });

                // Await the completion of the tasks
                if let Err(e) = mandatory_tasks_online.await {
                    eprintln!("An error occurred during scraping tasks: {:?}", e);
                    tracing::info!("An error occurred during scraping tasks: {:?}", e);
                    match scraping_failed_event.emit_all("scraping_failed_event", "Test") {
                        Ok(()) => (),
                        Err(e) => {
                            error!("Error During Scraping Event, Test Payload : {}", e)
                        }
                    } //TODO 
                    // Do not exit, continue running
                } else {
                    tracing::info!(
                        "All scraping tasks have been completed. No errors are reported."
                    );
                }

                // After all tasks are done, close the splash screen and show the main window
                splashscreen_window.close().unwrap();
                main_window.show().unwrap();

                current_app_handle
                    .emit_all("scraping-complete", {})
                    .unwrap();

                //TODO : we need to remove this as it causes a reload of the page and the emits dont get sent properly
                current_app_handle
                    .get_window("main")
                    .unwrap()
                    .eval("window.location.reload();") 
                    .unwrap();
                info!("Scraping signal has been sent.");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            close_splashscreen,
            get_games_images,
            clear_file,
            stop_get_games_images,
            check_folder_path,
            dominant_colors::check_dominant_color_vec,
            torrent_commands::api_get_torrent_details,
            torrent_commands::api_pause_torrent,
            torrent_commands::api_resume_torrent,
            torrent_commands::api_stop_torrent,
            torrent_commands::api_download_with_args,
            torrent_commands::api_automate_setup_install,
            torrent_commands::api_get_torrent_stats,
            torrent_commands::api_initialize_torrent_manager,
            torrent_commands::api_delete_torrent,
            commands_scraping::get_singular_game_info,
            executable_custom_commands::start_executable
        ])
        .manage(image_cache) // Make the cache available to commands
        .manage(torrent_calls::TorrentState::default()) // Make the torrent state session available to commands
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                PAUSE_FLAG.store(true, Ordering::Relaxed);
            }
        });

    // Keep the guard in scope to ensure proper log flushing
    Ok(())
}
