// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

mod game_info;
pub use crate::game_info::games_informations;

mod net_client_config;
pub use crate::net_client_config::custom_client_dns::CUSTOM_DNS_CLIENT;

mod settings_initialization;
pub use crate::settings_initialization::settings_configuration;

mod discovery_scraping;

use discovery_scraping::discovery::get_100_games_unordered;
use futures::future::join_all;
use scraper::{Html, Selector};
use serde_json::Value;
use settings_initialization::settings_creation::create_gamehub_settings_file;
use settings_initialization::settings_creation::create_image_cache_file;
use settings_initialization::settings_creation::create_installation_settings_file;
use tauri::menu::Menu;
use tauri::menu::MenuItem;
use std::error::Error;
use tauri::async_runtime::spawn_blocking;
use tauri::Emitter;
use tauri::Listener;
use tokio::task::LocalSet;
use tracing::error;
use tracing::info;
use tracing::warn;
use tauri_plugin_updater::UpdaterExt;
use std::str;

use serde::{Deserialize, Serialize};
use std::fmt;
use std::fs::File;
use std::io::Read;

use tauri::{Manager, Window};

use std::path::PathBuf;
use std::time::Instant;
use tauri::async_runtime::spawn;

use tauri::tray::TrayIconBuilder;
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
async fn stop_get_games_images() {
    STOP_FLAG.store(true, Ordering::Relaxed);
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedGameImages {
    game_link: String,
    images: Vec<String>,
}

#[tauri::command]
async fn get_games_images(
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

#[tauri::command]
async fn close_splashscreen(window: Window) {
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

fn delete_invalid_json_files(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn Error>> {
    let mut dir_path = app_handle.path().app_data_dir().unwrap();
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

// Function to perform a network request after ensuring frontend is ready, and emit network-failure if the request fails
async fn perform_network_request(app_handle: tauri::AppHandle) {
    info!(
        "perform_network_request: Waiting for frontend-ready before starting the network request."
    );

    // Get the main window to listen for 'frontend-ready'
    if let Some(main_window) = app_handle.get_webview_window("main") {
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
                            .emit("network-failure", failure_message)
                            .unwrap();
                    }
                }
            });
        });
    }
}

#[tauri::command]
fn allow_dir(app: tauri::AppHandle, path: std::path::PathBuf) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    app.fs_scope()
        .allow_directory(path.parent().unwrap_or(&path), true)
        .map_err(|err| err.to_string())
}

async fn start() {
    tauri::async_runtime::set(tokio::runtime::Handle::current());
    info!(
        "{}: Main.rs: Starting the application...",
        Utc::now().format("%a,%b,%e,%T,%Y")
    );
    let image_cache = Arc::new(Mutex::new(LruCache::<String, Vec<String>>::new(
        NonZeroUsize::new(30).unwrap(),
    )));

    tauri::Builder
        ::default()
        .setup(|app| {
            let start_time = Instant::now();
            let splashscreen_window = app.get_webview_window("splashscreen").unwrap();
            let main_window = app.get_webview_window("main").unwrap();
            let current_app_handle = app.app_handle().clone();

            let app_handle = app.handle().clone();

            let scraping_failed_event = app_handle.clone();
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_app_i = MenuItem::with_id(app, "show_app", "Show App", true, None::<&str>)?;
            let hide_app_i = MenuItem::with_id(app, "hide_app", "Hide App", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i, &show_app_i, &hide_app_i])?;
            
            TrayIconBuilder::new()
              .icon(app.default_window_icon().unwrap().clone())
              .menu(&menu)
              .menu_on_left_click(true)
              .on_menu_event(|app, event| match event.id.as_ref() {
                "quit" => {
                  info!("quit menu item was clicked");
                  app.exit(0);
                }
                "show_app" => {
                    info!("show app menu item was clicked");
                    if app.get_webview_window("main").unwrap().is_visible().unwrap() {
                        info!("Window is already visible")
                    } else {
                        match app.get_webview_window("main").unwrap().show() {
                            Ok(_) => {
                                info!("opened main windows")
                            },
                            Err(e) => error!("Error showing main window: {}", e)
                        };
                    };
                }
                "hide_app" => {
                    info!("hide app menu item was clicked");
                    if !app.get_webview_window("main").unwrap().is_visible().unwrap() {
                        info!("Window is already hidden")
                    } else {
                        match app.get_webview_window("main").unwrap().hide() {
                            Ok(_) => {
                                info!("hid main windows")
                            },
                            Err(e) => error!("Error hiding main window: {}", e)
                        };
                    };
                }
                _ => {
                    info!("menu item {:?} not handled", event.id);
                }
              })
              .build(app)?;

            // Delete JSON files missing the 'tag' field or corrupted and log the process
            if let Err(err) = delete_invalid_json_files(&current_app_handle) {
                eprintln!(
                    "Error during deletion of invalid or corrupted JSON files: {}",
                    err
                );
            }

            // Create the settings file if they haven't been created already
            if let Err(err) = create_installation_settings_file() {
                error!("Error while creating the installation settings file : {}", err);
                eprintln!("Error while creating the installation settings file : {}", err)
            }

            if let Err(err) = create_gamehub_settings_file() {
                error!("Error while creating the gamehub settings file : {}", err);
                eprintln!("Error while creating the gamehub settings file : {}", err)
            }

            if let Err(err) = create_image_cache_file() {
                error!("Error while creating the image cache file : {}", err);
                eprintln!("Error while creating the image cache file : {}", err)
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

                // Spawn blocking tasks for each `#[tokio::main]` function
                let task_1 = spawn_blocking(|| {
                    if let Err(e) = get_100_games_unordered() {
                        eprintln!("Error in get_100_games_unordered: {}", e);
                        tracing::info!("Error in get_100_games_unordered: {}", e);
                    } else {
                        tracing::info!(
                            "[get_100_games_unordered] has been completed. No errors are reported."
                        );
                    }
                });
            
                let task_2 = spawn_blocking(move || {
                    let first_app_handle_clone = first_app_handle.clone();
                    if let Err(e) = basic_scraping::scraping_func(first_app_handle_clone.clone()) {
                        eprintln!("Error in scraping_func: {}", e);
                        tracing::info!("Error in scraping_func: {}", e);
                    } else {
                        tracing::info!("[scraping_func] has been completed. No errors are reported.");
                        first_app_handle_clone.emit("new-games-ready", {}).unwrap();
                    }
                });
            
                let task_3 = spawn_blocking(move || {
                    let second_app_handle_clone = second_app_handle.clone();
                    if let Err(e) = basic_scraping::popular_games_scraping_func(second_app_handle_clone.clone()) {
                        eprintln!("Error in popular_games_scraping_func: {}", e);
                        tracing::info!("Error in popular_games_scraping_func: {}", e);
                    } else {
                        tracing::info!(
                            "[popular_games_scraping_func] has been completed. No errors are reported."
                        );
                        second_app_handle_clone.emit("popular-games-ready", {}).unwrap();
                    }
                });
            
                let task_4 = spawn_blocking(move || {
                    let third_app_handle_clone = third_app_handle.clone();
                    if let Err(e) =
                        basic_scraping::recently_updated_games_scraping_func(third_app_handle_clone.clone())
                    {
                        eprintln!("Error in recently_updated_games_scraping_func: {}", e);
                        tracing::info!("Error in recently_updated_games_scraping_func: {}", e);
                    } else {
                        tracing::info!(
                            "[recently_updated_games_scraping_func] has been completed. No errors are reported."
                        );
                        third_app_handle_clone
                            .emit("recent-updated-games-ready", {})
                            .unwrap();
                    }
                });
            
                let task_5 = spawn_blocking(move || {
                    let fourth_app_handle_clone = fourth_app_handle.clone();
                    if let Err(e) = commands_scraping::get_sitemaps_website(fourth_app_handle_clone.clone()) {
                        eprintln!("Error in get_sitemaps_website: {}", e);
                        tracing::info!("Error in get_sitemaps_website: {}", e);
                    } else {
                        tracing::info!(
                            "[get_sitemaps_website] has been completed. No errors are reported."
                        );
                        fourth_app_handle_clone.emit("sitemaps-ready", {}).unwrap();
                    }
                });
            
                // Wait for all tasks to complete
                let _ = tokio::join!(task_1, task_2, task_3, task_4, task_5);
            
                // After all tasks are done, close the splash screen and show the main window
                splashscreen_window.close().unwrap();
                main_window.show().unwrap();
            
                current_app_handle.emit("scraping-complete", {}).unwrap();
            
                // TODO: Remove this reload as it disrupts emits
                // current_app_handle
                //     .get_webview_window("main")
                //     .unwrap()
                //     .eval("window.location.reload();")
                //     .unwrap();
            
                info!("Scraping signal has been sent.");
                info!(
                    "It took : {:#?} seconds for the app to fully get every information!",
                    start_time.elapsed()
                );
            });
            
            
            
            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            get_games_images,
            stop_get_games_images,
            allow_dir,
            dominant_colors::check_dominant_color_vec,
            torrent_commands::torrents_list,
            torrent_commands::torrent_details,
            torrent_commands::torrent_stats,
            torrent_commands::torrent_create_from_url,
            torrent_commands::torrent_action_delete,
            torrent_commands::torrent_action_pause,
            torrent_commands::torrent_action_forget,
            torrent_commands::torrent_action_start,
            torrent_commands::get_torrent_full_settings,
            torrent_commands::config_change_only_path,
            torrent_commands::change_torrent_config,
            torrent_commands::run_automate_setup_install,
            torrent_commands::delete_game_folder_recursively,
            torrent_commands::get_torrent_idx_from_url,
            commands_scraping::get_singular_game_info,
            executable_custom_commands::start_executable,
            games_informations::executable_info_discovery,
            settings_configuration::get_installation_settings,
            settings_configuration::get_gamehub_settings,
            settings_configuration::get_dns_settings,
            settings_configuration::change_installation_settings,
            settings_configuration::change_gamehub_settings,
            settings_configuration::change_dns_settings,
            settings_configuration::reset_installation_settings,
            settings_configuration::reset_gamehub_settings,
            settings_configuration::reset_dns_settings,
            settings_configuration::clear_all_cache,
            settings_configuration::open_logs_directory,
        ])
        .manage(image_cache) // Make the cache available to commands
        .manage(torrentfunc::State::new().await) // Make the torrent state session available to commands
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if let Some(main_window) = app_handle.get_webview_window("main") {
                    main_window.hide().unwrap();
                } else {
                    println!("Main window not found during ExitRequested event.");
                }
                api.prevent_exit();
            }
        });
}

fn main() {
    let logs_dir = directories::BaseDirs::new()
        .expect("Could not determine base directories")
        .config_dir() // Points to AppData\Roaming (or equivalent on other platforms)
        .join("com.fitlauncher.carrotrub")
        .join("logs");

    let settings_dir = directories::BaseDirs::new()
        .expect("Could not determine base directories")
        .config_dir() // Points to AppData\Roaming (or equivalent on other platforms)
        .join("com.fitlauncher.carrotrub")
        .join("fitgirlConfig");

    // Ensure the logs directory exists
    std::fs::create_dir_all(&logs_dir).expect("Failed to create logs directory");
    std::fs::create_dir_all(&settings_dir).expect("Failed to create logs directory");

    // Set up the file-based logger
    let file_appender = tracing_appender::rolling::never(&logs_dir, "app.log");
    let (file_writer, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::fmt()
        .with_writer(file_writer) // Write logs to file
        .with_ansi(false) // Disable ANSI colors for log file
        .with_max_level(tracing::Level::INFO) // Log level set to INFO
        .init();
    warn!("Trying the logs_dir : {}", &logs_dir.display());
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("couldn't set up tokio runtime")
        .block_on(start())
}
