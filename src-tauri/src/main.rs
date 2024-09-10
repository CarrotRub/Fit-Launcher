// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


// TODO: Add Logging to a File.

// TODO: Add updater. 

mod scrapingfunc;
pub use crate::scrapingfunc::basic_scraping;
pub use crate::scrapingfunc::commands_scraping;

mod torrentfunc;
pub use crate::torrentfunc::torrent_calls;
pub use crate::torrentfunc::torrent_commands;
pub use crate::torrentfunc::torrent_functions;
pub use crate::torrentfunc::TorrentState;

mod custom_ui_automation;
pub use crate::custom_ui_automation::windows_custom_commands;

mod mighty;
use std::fs;

use serde_json::Value;
use std::error::Error;


use core::str;
use tauri::api::path::app_log_dir;

use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::fs::File;
use std::io::Read;
use std::fmt;
use tauri::{Manager, Window};
use tauri::{api::path::{BaseDirectory, resolve_path}, Env};

use std::time::{Duration, Instant};
use tokio::time::timeout;
use std::path::PathBuf;
use tracing_appender::non_blocking::WorkerGuard;

// use serde_json::json;
use std::path::Path;
// crates for requests
use reqwest;
use kuchiki::traits::*;
use anyhow::{Result, Context};
// stop threads
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
// caching
use std::num::NonZeroUsize;
use lru::LruCache;
use tokio::sync::Mutex;
use tauri::State;



// Define a shared boolean flag
static STOP_FLAG: AtomicBool = AtomicBool::new(false);
static PAUSE_FLAG: AtomicBool = AtomicBool::new(false);




#[derive(Debug, Serialize, Deserialize)]
struct Game {
    title: String,
    img: String,
    desc: String,
    magnetlink: String,
    href: String
}

#[derive(Debug, Serialize, Deserialize)]
struct SingleGame {
    my_all_images: Vec<String>,
}



#[derive(Debug, Serialize, Deserialize)]
struct GameImages {
    my_all_images: Vec<String>,
}





fn extract_hrefs_from_body(body: &str) -> Result<Vec<String>> {
    let document = kuchiki::parse_html().one(body);
    let mut hrefs = Vec::new();
    let mut p_index = 3;

    while p_index < 10 {
        let href_selector_str = format!(".entry-content > p:nth-of-type({}) a[href]", p_index);

        for anchor_elem in document
            .select(&href_selector_str)
            .map_err(|_| anyhow::anyhow!("Failed to select anchor element"))?
        {
            if let Some(href_link) = anchor_elem.attributes.borrow().get("href") {
                hrefs.push(href_link.to_string());
            }
        }

        p_index += 1;
    }

    Ok(hrefs)
}

async fn fetch_and_process_href(client: &Client, href: &str) -> Result<Vec<String>> {
    let processing_time = Instant::now();

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let mut image_srcs = Vec::new();
    let image_selector = "div.big-image > a > img";
    let noscript_selector = "noscript";
    println!("Start getting images process");

    let href_res = client
        .get(href)
        .send()
        .await
        .context("Failed to send HTTP request to HREF")?;
    if !href_res.status().is_success() {
        return Ok(image_srcs);
    }

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let href_body = href_res.text().await.context("Failed to read HREF response body")?;
    let href_document = kuchiki::parse_html().one(href_body);

    println!("Start getting text process");

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    for noscript in href_document
        .select(noscript_selector)
        .map_err(|_| anyhow::anyhow!("Failed to select noscript element"))?
    {
        let inner_noscript_html = noscript.text_contents();
        let inner_noscript_document = kuchiki::parse_html().one(inner_noscript_html);

        for img_elem in inner_noscript_document
            .select(image_selector)
            .map_err(|_| anyhow::anyhow!("Failed to select image element"))?
        {
            if let Some(src) = img_elem.attributes.borrow().get("src") {
                image_srcs.push(src.to_string());
            }
        }

        // Check if the processing time exceeds 4 seconds
        if processing_time.elapsed() > Duration::new(4, 0) {
            println!("Processing time exceeded 4 seconds, returning collected images so far");
            return Ok(image_srcs);
        }
    }

    Ok(image_srcs)
}

async fn scrape_image_srcs(url: &str) -> Result<Vec<String>> {
    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let client = Client::new();
    let res = client
        .get(url)
        .send()
        .await
        .context("Failed to send HTTP request")?;

    if !res.status().is_success() {
        return Err(anyhow::anyhow!("Failed to connect to the website or the website is down."));
    }

    let body = res.text().await.context("Failed to read response body")?;
    println!("Start extracting hrefs");
    let hrefs = extract_hrefs_from_body(&body)?;

    let mut image_srcs = Vec::new();

    for href in hrefs {
        println!("Start fetching process");
        let result = timeout(Duration::new(4, 0), fetch_and_process_href(&client, &href)).await;
        match result {
            Ok(Ok(images)) => {
                if !images.is_empty() {
                    image_srcs.extend(images);
                }
            },
            Ok(Err(e)) => println!("Error fetching images from href: {}", e),
            Err(_) => println!("Timeout occurred while fetching images from href"),
        }
    }

    Ok(image_srcs)
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


// TODO: Add `notify` crate to watch a file for changes without resorting to a performance-draining loop.

#[tauri::command]
async fn get_games_images(app_handle: tauri::AppHandle, game_link: String, image_cache: State<'_, ImageCache>) -> Result<GameImages, CustomError> {
    use std::collections::HashMap;
    use std::path::Path;
    use tokio::fs;

    STOP_FLAG.store(false, Ordering::Relaxed);

    // Persistent cache file path
    let mut cache_file_path = app_handle.path_resolver().app_cache_dir().unwrap();
    cache_file_path.push("image_cache.json");

    // Load the persistent cache from the file
    if Path::new(&cache_file_path).exists() {
        let data = fs::read_to_string(&cache_file_path).await.context("Failed to read cache file")
            .map_err(|e| CustomError { message: e.to_string() })?;
        let loaded_cache: HashMap<String, Vec<String>> = serde_json::from_str(&data)
            .context("Failed to parse cache file").map_err(|e| CustomError { message: e.to_string() })?;

        // Update in-memory LruCache with the loaded HashMap
        let mut cache = image_cache.lock().await;
        for (key, value) in loaded_cache {
            cache.put(key, value);
        }
    }

    // Check if the game images are already cached
    let mut cache = image_cache.lock().await;
    if let Some(cached_images) = cache.get(&game_link) {
        println!("Cache hit! Returning cached images.");
        return Ok(GameImages { my_all_images: cached_images.clone() }); // Return the cached images
    }

    drop(cache); // Release the lock before making network requests

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(CustomError { message: "Function stopped.".to_string() });
    }

    let image_srcs = scrape_image_srcs(&game_link).await
        .map_err(|e| CustomError { message: e.to_string() })?;

    // Update the in-memory cache and save it to the persistent cache file
    let mut cache = image_cache.lock().await;
    cache.put(game_link.clone(), image_srcs.clone());

    // Convert LruCache to HashMap for saving to persistent storage
    let cache_as_hashmap: HashMap<String, Vec<String>> = cache.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
    let updated_cache_data = serde_json::to_string_pretty(&cache_as_hashmap)
        .context("Failed to serialize cache data to JSON")
        .map_err(|e| CustomError { message: e.to_string() })?;
    fs::write(&cache_file_path, updated_cache_data).await
        .context("Failed to write cache data to file")
        .map_err(|e| CustomError { message: e.to_string() })?;


    println!("Done Getting Images");    
    Ok(GameImages { my_all_images: image_srcs }) // Return the newly scraped images
}


//Always serialize returns...
#[derive(Debug, Serialize, Deserialize)]
struct FileContent {
    content: String
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



#[tauri::command(async)]
async fn read_file(file_path: String) -> Result<FileContent, CustomError> {
    let mut file = File::open(&file_path)
        .map_err(|e| CustomError { message: e.to_string() })?;
    let mut data_content = String::new();
    file.read_to_string(&mut data_content)
        .map_err(|e| CustomError { message: e.to_string() })?;

    Ok(FileContent { content: data_content })
}


#[tauri::command]
async fn clear_file(file_path: String) -> Result<(), CustomError> {
    let path = Path::new(&file_path);

    // Attempt to create the file, truncating if it already exists
    File::create(&path).map_err(|err| CustomError{ message: err.to_string()})?;
    
    Ok(())
}


#[tauri::command]
async fn close_splashscreen(window: Window) {
  // Close splashscreen
  window.get_window("splashscreen").expect("no window labeled 'splashscreen' found").close().unwrap();
  // Show main window
  window.get_window("main").expect("no window labeled 'main' found").show().unwrap();
}


#[tauri::command]
fn check_folder_path(path: String) -> Result<bool, bool> {
    let path_obj = PathBuf::from(&path);
    
    // Debugging information
    println!("Checking path: {:?}", path_obj);
    
    if !path_obj.exists() {
        println!("Path does not exist.");
        return Ok(false);
    }
    if !path_obj.is_dir() {
        println!("Path is not a directory.");
        return Ok(false);
    }
    println!("Path is valid.");
    Ok(true)
}

fn delete_invalid_json_files(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn Error>> {
    println!("Starting the process to delete invalid JSON files...");

    // Retrieve the correct path dynamically
    let mut dir_path = app_handle.path_resolver().app_data_dir().unwrap();
    dir_path.push("tempGames");

    if !dir_path.exists() {
        println!("Directory does not exist: {:?}", dir_path);
        return Err(Box::new(std::io::Error::new(std::io::ErrorKind::NotFound, "Directory not found")));
    }

    let paths = fs::read_dir(&dir_path)?;

    for path in paths {
        let path = path?.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let file_content = fs::read_to_string(&path)?;

            let json_data: Value = match serde_json::from_str(&file_content) {
                Ok(data) => data,
                Err(err) => {
                    println!("Failed to parse JSON file {:?}: {}", path, err);
                    println!("Deleting corrupted file: {:?}", path);
                    fs::remove_file(&path)?;
                    println!("Deleted corrupted file successfully: {:?}", path);
                    continue;
                }
            };

            if !json_data.get("tag").is_some() {
                println!("Deleting file with missing 'tag' field: {:?}", path);
                fs::remove_file(&path)?;
                println!("Deleted file successfully: {:?}", path);
            }
        }
    }

    println!("Finished the process to delete invalid JSON files.");
    Ok(())
}

fn setup_logging(logs_dir: PathBuf) -> WorkerGuard {
    let file_appender = tracing_appender::rolling::never(logs_dir, "app.log");
    let (file_writer, guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::fmt()
        .with_writer(file_writer)
        .with_max_level(tracing::Level::INFO)
        .init();

    guard
}

fn main() -> Result<(), Box<dyn Error>> {
    let image_cache = Arc::new(Mutex::new(LruCache::<String, Vec<String>>::new(NonZeroUsize::new(30).unwrap())));
    let context = tauri::generate_context!();
    
    let logs_dir = app_log_dir(context.config()).unwrap();
    println!("path to logs : {:#?}", &logs_dir);
    let _log_guard = setup_logging(logs_dir); 

    tauri::Builder::default()
        .setup(|app| {
            let splashscreen_window = app.get_window("splashscreen").unwrap();
            let main_window = app.get_window("main").unwrap();
            let current_app_handle = app.app_handle();

            // Delete JSON files missing the 'tag' field or corrupted and log the process
            if let Err(e) = delete_invalid_json_files(&current_app_handle) {
                eprintln!("Error during deletion of invalid or corrupted JSON files: {}", e);
            }

            // Clone the app handle for use in async tasks
            let first_app_handle = current_app_handle.clone();
            let second_app_handle = current_app_handle.clone();
            let third_app_handle = current_app_handle.clone();
            let fourth_app_handle = current_app_handle.clone();

            // Perform asynchronous initialization tasks without blocking the main thread
            tauri::async_runtime::spawn(async move {
                tracing::info!("Starting async tasks");

                let mandatory_tasks_online = tauri::async_runtime::spawn_blocking(move || {
                    if let Err(e) = basic_scraping::scraping_func(first_app_handle) {
                        eprintln!("Error in scraping_func: {}", e);
                        // Do not exit, continue running
                    }

                    if let Err(e) = basic_scraping::popular_games_scraping_func(second_app_handle) {
                        eprintln!("Error in popular_games_scraping_func: {}", e);
                        // Do not exit, continue running
                    }

                    if let Err(e) = commands_scraping::get_sitemaps_website(fourth_app_handle) {
                        eprintln!("Error in get_sitemaps_website: {}", e);
                        // Do not exit, continue running
                    }

                    if let Err(e) = basic_scraping::recently_updated_games_scraping_func(third_app_handle) {
                        eprintln!("Error in recently_updated_games_scraping_func: {}", e);
                        // Do not exit, continue running
                    }
                });

                // Await the completion of the tasks
                if let Err(e) = mandatory_tasks_online.await {
                    eprintln!("An error occurred during scraping tasks: {:?}", e);
                    // Continue running even if errors occur
                }

                // After all tasks are done, close the splash screen and show the main window
                splashscreen_window.close().unwrap();
                main_window.show().unwrap();

                current_app_handle.emit_all("scraping-complete", {}).unwrap();
                current_app_handle.get_window("main").unwrap().eval("window.location.reload();").unwrap();
                println!("Scraping signal has been sent.");
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
            torrent_commands::api_get_torrent_details,
            torrent_commands::api_pause_torrent,
            torrent_commands::api_resume_torrent,
            torrent_commands::api_stop_torrent,
            torrent_commands::api_download_with_args,
            torrent_commands::api_automate_setup_install,
            torrent_commands::api_get_torrent_stats,
            torrent_commands::api_initialize_torrent_manager,
            commands_scraping::get_singular_game_info,
            windows_custom_commands::start_executable
        ])
        .manage(image_cache) // Make the cache available to commands 
        .manage(torrent_calls::TorrentState::default()) // Make the torrent state session available to commands
        .build({
            tauri::generate_context!()
        })
        .expect("error while building tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } => {
                PAUSE_FLAG.store(true, Ordering::Relaxed);
            }
            _ => {}
        });

    // Keep the guard in scope to ensure proper log flushing
    Ok(())
}