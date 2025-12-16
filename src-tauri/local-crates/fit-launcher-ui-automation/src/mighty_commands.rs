use std::path::PathBuf;

use specta::specta;
#[cfg(target_os = "windows")]
use tracing::{error, info};

use crate::{
    controller_client::{ControllerCommand, ControllerEvent, ExclusionAction},
    controller_manager::ControllerManager,
};

/// Start an executable using tauri::command
///
/// Uses ShellExecuteW to delegate to the Windows shell, which handles UAC
/// elevation automatically if the executable requires it.
#[tauri::command]
#[specta]
pub fn start_executable(path: String) {
    let path = PathBuf::from(path);

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        use windows::core::PCWSTR;

        // Convert path to wide string
        let path_wide: Vec<u16> = encode_utf16le_with_null(&path);

        // Get working directory (parent of executable)
        let current = PathBuf::from(".");
        let working_dir = path.parent().unwrap_or(&current);
        let working_dir_wide: Vec<u16> = encode_utf16le_with_null(working_dir);

        // ShellExecuteW with "open" verb - Windows handles UAC automatically
        let result = unsafe {
            ShellExecuteW(
                None,
                PCWSTR::null(),
                PCWSTR(path_wide.as_ptr()),
                PCWSTR::null(),
                PCWSTR(working_dir_wide.as_ptr()),
                SW_SHOWNORMAL,
            )
        };

        let result_code = result.0 as isize;
        if result_code > 32 {
            info!("Executable launched via shell: {}", path.display());
        } else {
            error!(
                "Failed to launch {path:?} via shell, error code: {}",
                result_code
            );
        }
    }

    #[cfg(target_os = "linux")]
    // TODO: WINEPREFIX + wine command configuration
    // by allowing custom commands, `protonrun` e.g. should be supported automatically
    // Add usage of wine + check beforehand with Flatpak if steamos
    {}
}

#[cfg(windows)]
fn encode_utf16le_with_null(s: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    s.as_ref().encode_wide().chain(std::iter::once(0)).collect()
}

#[tauri::command]
#[specta]
pub async fn folder_exclusion(action: ExclusionAction) -> Result<(), String> {
    use std::time::Duration;
    use tracing::{error, info};

    let manager = ControllerManager::global();

    manager
        .ensure_running()
        .map_err(|e| format!("Controller not available: {}", e))?;

    info!("Sending command...");
    manager
        .send_command(&ControllerCommand::FolderExclusion { action })
        .map_err(|e| format!("Failed to send command: {}", e))?;
    info!("command sent...");
    let timeout = Duration::from_secs(10);
    let start = std::time::Instant::now();

    loop {
        if start.elapsed() > timeout {
            return Err("Folder exclusion timed out".into());
        }

        let taken_client = manager.take_client();
        let recv_result = match taken_client {
            Ok(Some(mut client)) => {
                let res = tokio::task::spawn_blocking(move || {
                    let r = client.recv_timeout(Duration::from_millis(500));
                    (client, r)
                })
                .await
                .map_err(|e| e.to_string());

                match res {
                    Ok((client_back, result)) => {
                        let _ = manager.put_client(client_back);
                        result.map_err(|e| e.to_string())
                    }
                    Err(e) => Err(e),
                }
            }
            _ => Err("Controller not connected".to_string()),
        };

        match recv_result {
            Ok(Some(ControllerEvent::FolderExclusionResult { success, error })) => {
                if success {
                    info!("Folder exclusion succeeded");
                    return Ok(());
                } else {
                    return Err(error.unwrap_or("Folder exclusion failed".into()));
                }
            }
            Ok(Some(_)) => {
                // Ignore unrelated events
            }
            Ok(None) => {}
            Err(e) => {
                error!("Controller error: {}", e);
                return Err(e);
            }
        }
    }
}
