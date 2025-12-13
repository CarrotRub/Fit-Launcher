use fit_launcher_torrent::functions::TorrentSession;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Result as TauriResult;
use tauri::async_runtime::block_on;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{App, Manager};
use tokio::task::block_in_place;
use tracing::info;

pub fn setup_tray(app: &App) -> TauriResult<()> {
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
                static PROCESSING: AtomicBool = AtomicBool::new(false);

                info!("quit menu item clicked... attempting graceful aria2 shutdown...");

                if PROCESSING.load(Ordering::Acquire) {
                    return;
                }

                PROCESSING.store(true, Ordering::Release);
                let session = app.state::<TorrentSession>();

                block_in_place(|| block_on(async { session.shutdown().await }));

                std::process::exit(0);
            }
            "show_app" => {
                info!("show_app menu item clicked");
                if let Some(win) = app.get_webview_window("main") {
                    if !win.is_visible().unwrap_or(false) {
                        let _ = win.show();
                    }
                    let _ = win.set_focus();
                }
            }
            "hide_app" => {
                info!("hide_app menu item clicked");
                if let Some(win) = app.get_webview_window("main")
                    && win.is_visible().unwrap_or(false)
                {
                    let _ = win.hide();
                }
            }
            _ => {
                info!("unhandled tray menu id: {}", event.id.0);
            }
        })
        .build(app)?;

    Ok(())
}
