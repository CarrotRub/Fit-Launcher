use fit_launcher_scraping::discovery::get_100_games_unordered;
use fit_launcher_scraping::get_sitemaps_website;
use fit_launcher_scraping::global::functions::run_all_scrapers;
use fit_launcher_torrent::functions::TorrentSession;
use lru::LruCache;
use std::error::Error;
use std::num::NonZeroUsize;
use std::sync::Arc;
use std::time::Instant;
use tauri::async_runtime::spawn;
use tauri::ipc::InvokeHandler;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tracing::{error, info};

use super::json_cleanup::delete_invalid_json_files;
use super::network::perform_network_request;
use super::tray::setup_tray;

use fit_launcher_aria2::aria2::start_aria2_monitor;
use fit_launcher_torrent::LibrqbitSession;
use specta::specta;
use tauri_helper::specta_collect_commands;

use crate::game_info::*;
use crate::image_colors::*;
use crate::utils::*;

pub async fn start_app() -> Result<(), Box<dyn Error>> {
    info!("start_app: starting");

    let image_cache = Arc::new(Mutex::new(LruCache::<String, Vec<String>>::new(
        NonZeroUsize::new(30).unwrap(),
    )));

    let specta_builder =
        tauri_specta::Builder::<tauri::Wry>::new().commands(specta_collect_commands!());

    #[cfg(debug_assertions)]
    {
        use specta_typescript::Typescript;

        specta_builder
            .export(
                Typescript::default().bigint(specta_typescript::BigIntExportBehavior::Number),
                "../src/bindings.ts",
            )
            .expect("Failed to export TS bindings");
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            info!(
                "Another instance attempted with args={:?} cwd={:?}",
                args, cwd
            );
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
            if let Some(splash) = app.get_webview_window("splashscreen") {
                let _ = splash.show();
                let _ = splash.set_focus();
            }
        }))
        .setup(|app| {
            let app_handle = app.handle().clone();

            if let Err(err) = delete_invalid_json_files(&app_handle) {
                error!("Error deleting JSON: {:#?}", err);
            }

            for create_fn in [
                fit_launcher_config::settings::creation::create_installation_settings_file,
                fit_launcher_config::settings::creation::create_gamehub_settings_file,
                fit_launcher_config::settings::creation::create_image_cache_file,
            ] {
                if let Err(err) = create_fn() {
                    error!("Error creating settings: {:#?}", err);
                }
            }

            spawn({
                let app_clone = app_handle.clone();
                async move {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;

                    let session = app_clone.state::<TorrentSession>();
                    match session.init_client().await {
                        Ok(_) => {
                            if let Ok(client) = session.aria2_client().await {
                                start_aria2_monitor(
                                    app_clone.clone(),
                                    Arc::new(Mutex::new(client)),
                                );
                            }
                        }
                        Err(err) => error!("ARIA2 init failed: {:#?}", err),
                    }
                }
            });

            let app_for_scrapers = app_handle.clone();
            std::thread::spawn(move || {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("Failed to create current_thread runtime");

                let local = tokio::task::LocalSet::new();

                local.block_on(&rt, async move {
                    let start = Instant::now();

                    let (scrapers_res, sitemap_res) = tokio::join!(
                        async { run_all_scrapers(app_for_scrapers.clone()).await },
                        async { get_sitemaps_website(app_for_scrapers.clone()).await }
                    );

                    if scrapers_res.is_err() {
                        error!("run_all_scrapers failed");
                    }
                    if sitemap_res.is_err() {
                        error!("get_sitemaps_website failed");
                    }

                    if let Some(splash) = app_for_scrapers.get_window("splashscreen") {
                        let _ = splash.close();
                    }
                    if let Some(main) = app_for_scrapers.get_window("main") {
                        let _ = main.show();
                        let _ = main.emit("backend-ready", ());
                    }

                    info!("Critical scrapers done in {:?}", start.elapsed());
                });
            });

            spawn({
                let app_clone = app_handle.clone();
                async move {
                    if let Err(err) = get_100_games_unordered(app_clone.clone()).await {
                        error!("get_100_games_unordered failed: {:#?}", err);
                    }
                }
            });

            spawn({
                let app_clone = app_handle.clone();
                async move {
                    perform_network_request(app_clone).await;
                }
            });

            if let Err(e) = setup_tray(app) {
                error!("Tray setup failed: {:#?}", e);
            }

            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri_helper::tauri_collect_commands!())
        .manage(image_cache)
        .manage(TorrentSession::new().await)
        .manage(LibrqbitSession::new().await);

    let app = app.build(tauri::generate_context!())?;
    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            if let Some(main) = app_handle.get_webview_window("main") {
                let _ = main.hide();
            }
            api.prevent_exit();
        }
    });

    Ok(())
}
