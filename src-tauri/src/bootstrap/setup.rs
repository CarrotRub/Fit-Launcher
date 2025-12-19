use crate::bootstrap::hooks::shutdown_hook;
use crate::game_info::*;
use crate::image_colors::*;
use crate::utils::*;
use fit_launcher_cache::CacheManager;
use fit_launcher_download_manager::aria2::Aria2WsClient;
use fit_launcher_download_manager::manager::DownloadManager;
use fit_launcher_scraping::{
    discovery::refresh_discovery_games, rebuild_search_index, scraping::run_all_scrapers,
    sitemap::download_all_sitemaps,
};
use fit_launcher_torrent::{LibrqbitSession, functions::TorrentSession};
use fit_launcher_ui_automation::api::InstallationManager;
use lru::LruCache;
use std::{num::NonZeroUsize, sync::Arc, time::Instant};
use tauri::{Emitter, Manager, async_runtime::spawn};
use tokio::sync::Mutex;
use tracing::{error, info};

pub async fn start_app() -> anyhow::Result<()> {
    info!("start_app: starting");

    #[cfg(debug_assertions)]
    {
        use specta_typescript::Typescript;
        use tauri_helper::specta_collect_commands;

        let specta_builder =
            tauri_specta::Builder::<tauri::Wry>::new().commands(specta_collect_commands!());

        let path = "../src/bindings.ts";
        specta_builder
            .export(
                Typescript::default()
                    .bigint(specta_typescript::BigIntExportBehavior::Number)
                    .formatter(|path| {
                        eprintln!(
                            "format: {:?}",
                            std::process::Command::new(if cfg!(windows) {
                                "npx.cmd"
                            } else {
                                "npx"
                            })
                            .arg("eslint")
                            .arg("--fix")
                            .arg(path)
                            .status()
                        );
                        Ok(())
                    }),
                path,
            )
            .expect("Failed to export TS bindings");
    }

    let image_cache = Arc::new(Mutex::new(LruCache::<String, Vec<String>>::new(
        NonZeroUsize::new(30).unwrap(),
    )));

    // CRITICAL: single-instance plugin MUST be the FIRST plugin registered.
    // Otherwise it may not work reliably on Windows.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            info!(
                "Single instance: Another instance attempted with args={:?} cwd={:?}",
                args, cwd
            );

            // Focus logic must be tolerant to hidden or partially initialized windows.
            if let Some(main) = app.get_webview_window("main") {
                info!("Single instance: Focusing main window");
                let _ = main.show();
                let _ = main.unminimize();
                let _ = main.set_focus();
            } else if let Some(splash) = app.get_webview_window("splashscreen") {
                info!("Single instance: Focusing splashscreen");
                let _ = splash.show();
                let _ = splash.unminimize();
                let _ = splash.set_focus();
            } else {
                info!("Single instance: No windows found to focus");
            }
        }))
        // Register remaining plugins after single-instance
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    let app = builder
        .setup({
            let image_cache = image_cache;

            move |app| {
                let app_handle = app.handle().clone();

                // Initialize state here to ensure it only runs on the primary instance.
                app.manage(image_cache);
                app.manage(InstallationManager::new());

                // TorrentSession::new() is synchronous (just loads config from disk),
                // ensuring state is available immediately for commands like get_download_settings.
                // Wrapped in Arc so it can be shared with Aria2WsClient for reconnection.
                let torrent_session = Arc::new(TorrentSession::new());
                app.manage(torrent_session);

                shutdown_hook(app_handle.clone());

                for create_fn in [
                    fit_launcher_config::settings::creation::create_installation_settings_file,
                    fit_launcher_config::settings::creation::create_gamehub_settings_file,
                    fit_launcher_config::settings::creation::create_image_cache_file,
                ] {
                    if let Err(err) = create_fn() {
                        error!("Error creating settings: {:#?}", err);
                    }
                }

                // Network and download subsystems are started asynchronously so UI can render early.
                spawn({
                    let app = app_handle.clone();
                    async move {
                        info!("Download subsystem spawn: starting LibrqbitSession");
                        // LibrqbitSession creates a torrent session which may be heavier.
                        let librqbit = LibrqbitSession::new().await;
                        info!("Download subsystem spawn: LibrqbitSession created, managing state");
                        app.manage(librqbit);

                        info!("Download subsystem spawn: getting TorrentSession state");
                        let session = app.state::<Arc<TorrentSession>>();
                        let librqbit = app.state::<LibrqbitSession>();

                        info!("Download subsystem spawn: calling init_client");
                        match session.init_client().await {
                            Ok(_) => {
                                info!("Download subsystem spawn: init_client succeeded, getting aria2_client");
                                if let Ok(client) = session.aria2_client().await {
                                    let client = Arc::new(Mutex::new(client));
                                    // Clone the Arc<TorrentSession> for Aria2WsClient reconnection capability
                                    let session_arc = Arc::clone(&session);

                                    info!("Download subsystem spawn: creating DownloadManager");
                                    let manager = DownloadManager::new(
                                        Arc::new(Mutex::new(Aria2WsClient::new(client.clone(), session_arc))),
                                        app.clone(),
                                        session.config().await.rpc,
                                        librqbit.clone(),
                                    );

                                    if let Err(e) = manager.load_from_disk().await {
                                        error!("Failed to load persisted jobs: {:?}", e);
                                    }

                                    info!("Download subsystem spawn: managing DownloadManager and starting dispatcher");
                                    app.manage(manager.clone());
                                    fit_launcher_download_manager::dispatch::spawn_dispatcher(
                                        manager, client,
                                    );
                                    info!("Download subsystem spawn: complete");
                                }
                            }
                            Err(err) => error!("ARIA2 init failed: {:#?}", err),
                        }
                    }
                });

                // Heavy startup work is isolated on a dedicated runtime to avoid blocking Tauri.
                let app_for_scrapers = app_handle.clone();
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Builder::new_current_thread()
                        .enable_all()
                        .build()
                        .expect("Failed to create runtime");

                    let local = tokio::task::LocalSet::new();

                    local.block_on(&rt, async move {
                        let start = Instant::now();

                        // Phase 1: Download sitemaps (populates game URLs in database)
                        info!("Phase 1: Syncing sitemap data...");
                        if let Err(e) = download_all_sitemaps(&app_for_scrapers).await {
                            error!("Sitemap sync failed: {:#?}", e);
                        }

                        // Phase 2: Build search index (uses sitemap data)
                        info!("Phase 2: Building search index...");
                        if let Err(e) = rebuild_search_index(app_for_scrapers.clone()).await {
                            error!("Search index build failed: {:#?}", e);
                            if let Some(main) = app_for_scrapers.get_window("main") {
                                let _ = main.emit("search-index-error", e.to_string());
                            }
                        } else if let Some(main) = app_for_scrapers.get_window("main") {
                            let _ = main.emit("search-index-ready", ());
                        }

                        // Phase 3: Run scrapers (fills UI categories)
                        info!("Phase 3: Updating game categories...");
                        if let Err(e) = run_all_scrapers(app_for_scrapers.clone()).await {
                            error!("Scrapers failed: {:#?}", e);
                        }

                        // Show main window
                        if let Some(splash) = app_for_scrapers.get_window("splashscreen") {
                            let _ = splash.close();
                        }
                        if let Some(main) = app_for_scrapers.get_window("main") {
                            let _ = main.show();
                            let _ = main.emit("backend-ready", ());
                        }

                        info!("Startup complete in {:?}", start.elapsed());
                    });
                });

                spawn({
                    let app = app_handle.clone();
                    async move {
                        if let Err(err) = refresh_discovery_games(app).await {
                            error!("refresh_discovery_games failed: {:#?}", err);
                        }
                    }
                });

                spawn({
                    let app = app_handle.clone();
                    async move {
                        crate::bootstrap::network::perform_network_request(app).await;
                    }
                });

                spawn({
                    let app = app_handle.clone();
                    async move {
                        match CacheManager::new().await {
                            Ok(manager) => {
                                app.manage(Arc::new(manager));
                            }
                            Err(e) => {
                                error!("Failed to create cache manager: {e}");
                            }
                        }
                    }
                });

                if let Err(e) = crate::bootstrap::tray::setup_tray(app) {
                    error!("Tray setup failed: {:#?}", e);
                }



                Ok(())
            }
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri_helper::tauri_collect_commands!());

    let app = app.build(tauri::generate_context!())?;

    app.run(|app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                // Tray-based UX requires suppressing implicit exits unless explicitly quitting.
                if crate::bootstrap::tray::QUITTING.load(std::sync::atomic::Ordering::Acquire) {
                    return;
                }

                if let Some(main) = app_handle.get_webview_window("main") {
                    let _ = main.hide();
                }
                api.prevent_exit();
            }
            tauri::RunEvent::Exit => {
                // Shutdown subsystems before process exit (Not Bittorrent session as that uses ARIA2 daemon in functions.rs).
                // This ensures ports are released for relaunch scenarios.
                info!("RunEvent::Exit - shutting down subsystems");

                if let Some(librqbit) = app_handle.try_state::<LibrqbitSession>() {
                    librqbit.shutdown();
                }

                info!("Subsystems shut down, process exiting");
            }
            _ => {}
        }
    });

    Ok(())
}
