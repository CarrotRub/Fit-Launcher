#[cfg(target_os = "windows")]
use std::process::Command;

use tracing::{error, info};

/// Start an executable using tauri::command
///
/// Do not worry about using String, since the path will always be obtained by dialog through Tauri thus making it always corret for the OS.
#[tauri::command]
pub fn start_executable(path: String) {
    // Here, use this **ONLY** for windows OS
    #[cfg(target_os = "windows")]
    match Command::new(&path).spawn() {
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
    // Add usage of wine + check beforehand with Flatpak if steamos
    todo!()
}
