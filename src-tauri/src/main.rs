// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::collections::HashMap;
use std::fs;
mod image_colors;
pub use crate::image_colors::dominant_colors;
mod game_info;
pub use crate::game_info::games_informations;
mod downloadingfunc;
pub use crate::downloadingfunc::downloads_function;
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use fit_launcher_config::settings::creation::create_gamehub_settings_file;
use fit_launcher_config::settings::creation::create_image_cache_file;
use fit_launcher_config::settings::creation::create_installation_settings_file;
use fit_launcher_scraping::discovery::get_100_games_unordered;
use fit_launcher_scraping::get_sitemaps_website;
use fit_launcher_scraping::global::functions::popular_games_scraping_func;
use fit_launcher_scraping::global::functions::recently_updated_games_scraping_func;
use fit_launcher_scraping::global::functions::scraping_func;
use fit_launcher_torrent::functions::TorrentSession;
use futures::future::join_all;
use scraper::{Html, Selector};
use serde_json::Value;
use std::error::Error;
use std::str;
use tauri::async_runtime::spawn_blocking;
use tauri::menu::Menu;
use tauri::menu::MenuItem;
use tauri::Emitter;
use tauri::Listener;
use tracing::{info, warn, error};
use serde::{Deserialize, Serialize};
use std::fmt;
use tauri::{Manager, Window};
use std::time::Instant;
use tauri::async_runtime::spawn;
use tauri::tray::TrayIconBuilder;
use std::path::Path;
use anyhow::Result;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use lru::LruCache;
use std::num::NonZeroUsize;
use tauri::State;
use tokio::sync::Mutex;
use chrono::Utc;
pub mod utils;
pub use utils::*;

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
    use std::fs;

    let dir = if fs::metadata(&path)
        .map_err(|err| err.to_string())?
        .is_file()
    {
        path.parent().unwrap_or(&path).to_path_buf()
    } else {
        path
    };

    app.fs_scope()
        .allow_directory(dir, true)
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
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            info!(
                "Another instance attempted to launch with arguments: {:?}, cwd: {:?}",
                args, cwd
            );

            // Bring the main window to focus if it exists
            if let Some(main_window) = app.get_webview_window("main") {
                if main_window.is_visible().unwrap() {
                    info!("Window is already visible")
                } else {
                    match main_window.show() {
                        Ok(_) => {
                            info!("opened main windows")
                        },
                        Err(e) => error!("Error showing main window: {}", e)
                    };
                };
                main_window.set_focus().unwrap_or_else(|e| {
                    error!("Failed to focus on main window: {}", e);
                });
            };

            if let Some(splashscreen_window) = app.get_webview_window("splashscreen") {
                if splashscreen_window.is_visible().unwrap() {
                    info!("Window is already visible")
                } else {
                    match splashscreen_window.show() {
                        Ok(_) => {
                            info!("opened main windows")
                        },
                        Err(e) => error!("Error showing main window: {}", e)
                    };
                };
                splashscreen_window.set_focus().unwrap_or_else(|e| {
                    error!("Failed to focus on splashscreen window: {}", e);
                });
            }
        }))
        .setup(|app| {
            let start_time = Instant::now();
            let splashscreen_window = app.get_webview_window("splashscreen").unwrap();
            let main_window = app.get_webview_window("main").unwrap();
            let current_app_handle = app.app_handle().clone();

            let app_handle = app.handle().clone();

            let _scraping_failed_event = app_handle.clone();
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_app_i = MenuItem::with_id(app, "show_app", "Show App", true, None::<&str>)?;
            let hide_app_i = MenuItem::with_id(app, "hide_app", "Hide App", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i, &show_app_i, &hide_app_i])?;
            
            
            TrayIconBuilder::new()
              .icon(app.default_window_icon().unwrap().clone())
              .menu(&menu)
              .show_menu_on_left_click(true)
              .on_menu_event(|app, event| match event.id.as_ref() {
                "quit" => {
                  info!("quit menu item was clicked");
                  std::process::exit(0);
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
                    if let Err(e) = scraping_func(first_app_handle_clone.clone()) {
                        eprintln!("Error in scraping_func: {}", e);
                        tracing::info!("Error in scraping_func: {}", e);
                    } else {
                        tracing::info!("[scraping_func] has been completed. No errors are reported.");
                        first_app_handle_clone.emit("new-games-ready", {}).unwrap();
                    }
                });
            
                let task_3 = spawn_blocking(move || {
                    let second_app_handle_clone = second_app_handle.clone();
                    if let Err(e) = popular_games_scraping_func(second_app_handle_clone.clone()) {
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
                        recently_updated_games_scraping_func(third_app_handle_clone.clone())
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
                    if let Err(e) = get_sitemaps_website(fourth_app_handle_clone.clone()) {
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
            
                current_app_handle.emit("scraping-complete", None::<()>).unwrap();
            
                // TODO: Remove this reload as it disrupts emits
                current_app_handle
                    .get_webview_window("main")
                    .unwrap()
                    .eval("window.location.reload();")
                    .unwrap();
            
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
        .invoke_handler(tauri_helper::tauri_collect_commands!())
        .manage(image_cache) // Make the cache available to commands
        .manage(TorrentSession::new().await) // Make the torrent state session available to commands
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
