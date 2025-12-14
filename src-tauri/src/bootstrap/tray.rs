use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Result as TauriResult;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{App, Manager};
use tracing::info;

/// Global flag to signal intentional quit (bypasses hide-to-tray behavior)
pub static QUITTING: AtomicBool = AtomicBool::new(false);

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

                info!("quit menu item clicked... shutting down...");

                if PROCESSING.load(Ordering::Acquire) {
                    return;
                }

                PROCESSING.store(true, Ordering::Release);

                // Set global quit flag to bypass ExitRequested prevention
                QUITTING.store(true, Ordering::Release);

                // Force exit immediately - aria2 will be cleaned up by OS via job object
                // This avoids potential async deadlocks that could freeze the quit
                info!("Exiting application...");
                std::process::exit(0);
            }
            "show_app" => {
                info!("show_app menu item clicked");
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.unminimize();
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
