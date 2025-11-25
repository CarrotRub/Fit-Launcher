use std::path::PathBuf;
#[cfg(target_os = "windows")]
use std::process::Command;

use specta::specta;
#[cfg(target_os = "windows")]
use tracing::{error, info};

/// Start an executable using tauri::command
///
/// Do not worry about using String, since the path will always be obtained by dialog through Tauri thus making it always corret for the OS.
#[tauri::command]
#[specta]
pub fn start_executable(path: String) {
    let path = PathBuf::from(path);
    let current = PathBuf::from(".");
    #[cfg(target_os = "windows")]
    match Command::new(&path)
        .current_dir(path.parent().unwrap_or_else(|| &current))
        .spawn()
    {
        Ok(child) => {
            info!("Executable started with PID: {}", child.id());
        }
        Err(e) => {
            error!("Failed to start executable: {}", e);

            if let Some(32) = e.raw_os_error() {
                error!("Another process is using the executable.");
            }
        }
    }

    #[cfg(target_os = "linux")]
    // TODO: WINEPREFIX + wine command configuration
    // by allowing custom commands, `protonrun` e.g. should be supported automatically
    // Add usage of wine + check beforehand with Flatpak if steamos
    {}
}
