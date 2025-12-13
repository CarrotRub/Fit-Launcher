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
use fit_launcher_torrent::LibrqbitSession;
use fit_launcher_torrent::functions::TorrentSession;
use fit_launcher_ui_automation::api::InstallationManager;
use lru::LruCache;
use std::{num::NonZeroUsize, sync::Arc, time::Instant};
use tauri::{Emitter, Manager, async_runtime::spawn};
use tauri_helper::specta_collect_commands;
use tokio::sync::Mutex;
use tracing::{error, info};

pub async fn start_app() -> anyhow::Result<()> {
    info!("start_app: starting");

    #[cfg(debug_assertions)]
    {
        use specta_typescript::Typescript;

        let specta_builder =
            tauri_specta::Builder::<tauri::Wry>::new().commands(specta_collect_commands!());

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
                let app_clone = app_handle.clone();
                async move {
                    if let Err(err) = refresh_discovery_games(app_clone.clone()).await {
                        error!("refresh_discovery_games failed: {:#?}", err);
                    }
                }
            });

            spawn({
                let app_clone = app_handle.clone();
                async move {
                    crate::bootstrap::network::perform_network_request(app_clone).await;
                }
            });

            spawn({
                let app_clone = app_handle.clone();
                async move {
                    match CacheManager::new().await {
                        Ok(manager) => {
                            app_clone.manage(Arc::new(manager));
                        }
                        Err(e) => {
                            error!("failed to create cache manager: {e}");
                        }
                    }
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
