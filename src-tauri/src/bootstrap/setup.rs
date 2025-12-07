use crate::bootstrap::hooks::shutdown_hook;
use crate::bootstrap::json_cleanup;
use crate::game_info::*;
use crate::image_colors::*;
use crate::utils::*;
use fit_launcher_download_manager::aria2::Aria2WsClient;
use fit_launcher_download_manager::manager::DownloadManager;
use fit_launcher_integrations::ManagedStronghold;
use fit_launcher_scraping::{
    discovery::get_100_games_unordered, get_sitemaps_website, global::functions::run_all_scrapers,
    rebuild_search_index,
};
use fit_launcher_torrent::LibrqbitSession;
use fit_launcher_torrent::functions::TorrentSession;
use fit_launcher_ui_automation::api::InstallationManager;
use lru::LruCache;
use serde_json::Value;
use std::{num::NonZeroUsize, path::PathBuf, sync::Arc, time::Instant};
use tauri::{Emitter, Manager, async_runtime::spawn};
use tauri_helper::specta_collect_commands;
use tokio::sync::Mutex;
use tracing::{error, info};

pub async fn start_app() -> anyhow::Result<()> {
    info!("start_app: starting");

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

    let image_cache = Arc::new(Mutex::new(LruCache::<String, Vec<String>>::new(
        NonZeroUsize::new(30).unwrap(),
    )));

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

            shutdown_hook(app_handle.clone());

            if let Err(err) = json_cleanup::delete_invalid_json_files(&app_handle) {
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
                    let session = app_clone.state::<TorrentSession>();
                    let librqbit_session = app_clone.state::<LibrqbitSession>();

                    match session.init_client().await {
                        Ok(_) => {
                            if let Ok(client) = session.aria2_client().await {
                                let client = Arc::new(Mutex::new(client));

                                let manager = DownloadManager::new(
                                    Arc::new(Mutex::new(Aria2WsClient::new(client.clone()))),
                                    app_clone.clone(),
                                    session.config().await.rpc,
                                    librqbit_session.clone(),
                                );

                                if let Err(e) = manager.load_from_disk().await {
                                    error!("Failed to load persisted jobs: {:?}", e);
                                }

                                app_clone.manage(manager.clone());

                                fit_launcher_download_manager::dispatch::spawn_dispatcher(
                                    manager.clone(),
                                    client,
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
                    .expect("Failed to create runtime");
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

                    if let Err(e) = rebuild_search_index(app_for_scrapers.clone()).await {
                        error!("Failed to build search index: {:#?}", e);
                        if let Some(main) = app_for_scrapers.get_window("main") {
                            let _ = main.emit("search-index-error", e.to_string());
                        }
                    } else if let Some(main) = app_for_scrapers.get_window("main") {
                        let _ = main.emit("search-index-ready", ());
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
                    crate::bootstrap::network::perform_network_request(app_clone).await;
                }
            });

            if let Err(e) = crate::bootstrap::tray::setup_tray(app) {
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
        .manage(InstallationManager::new())
        .manage(LibrqbitSession::new().await)
        .manage(ManagedStronghold(std::sync::Mutex::new(None)));

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
