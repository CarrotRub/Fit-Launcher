use directories::BaseDirs;
use specta::specta;
use std::path::PathBuf;
use std::time::Duration;
use tracing::{error, info};

use crate::{
    controller_client::{ControllerCommand, ControllerEvent},
    controller_manager::ControllerManager,
    defender::{
        ExclusionAction, ExclusionCleanupPolicy, FolderExclusionEntry, load_exclusions, now_utc,
        save_exclusions,
    },
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
    let manager = ControllerManager::global();

    manager
        .ensure_running()
        .map_err(|e| format!("Controller not available: {}", e))?;

    info!("Sending command...");
    manager
        .send_command(&ControllerCommand::FolderExclusion {
            action: action.clone(),
        })
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

                    let Some(base_dirs) = BaseDirs::new() else {
                        error!("Failed to determine base directories");
                        return Err(
                            "Folder added successfully but failed to determine base directories"
                                .to_string(),
                        );
                    };

                    let exclusions_file_path = base_dirs
                        .config_dir()
                        .join("com.fitlauncher.carrotrub")
                        .join("fitgirlConfig")
                        .join("settings")
                        .join("data")
                        .join("folder_exclusions.json");

                    let mut file = load_exclusions(&exclusions_file_path);

                    let excluded_path = match &action {
                        ExclusionAction::Add(p) | ExclusionAction::Remove(p) => p.clone(),
                    };

                    match &action {
                        ExclusionAction::Add(_) => {
                            manager.set_folder_exclusion_active(true)?;
                            if !file.entries.iter().any(|e| e.path == excluded_path) {
                                file.entries.push(FolderExclusionEntry {
                                    path: excluded_path.clone(),
                                    timestamp_utc: now_utc(),
                                });
                            }
                        }

                        ExclusionAction::Remove(_) => {
                            manager.set_folder_exclusion_active(false)?;
                            file.entries.retain(|e| e.path != excluded_path);
                        }
                    }

                    save_exclusions(&exclusions_file_path, &file)
                        .map_err(|e| format!("Failed to save exclusion file: {e}"))?;

                    info!("Path excluded and saved: {}", excluded_path);
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

#[tauri::command]
#[specta]
pub async fn folder_exclusion_cleanup(policy: ExclusionCleanupPolicy) -> Result<(), String> {
    let manager = ControllerManager::global();

    manager
        .ensure_running()
        .map_err(|e| format!("Controller not available: {}", e))?;

    info!("Sending command...");
    manager
        .send_command(&ControllerCommand::CleanupPolicy {
            exclusion_folder: policy.clone(),
        })
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
                    info!("Folder exclusion cleanup succeeded");

                    let Some(base_dirs) = BaseDirs::new() else {
                        error!("Failed to determine base directories");
                        return Err(
                            "Folder added successfully but failed to determine base directories"
                                .to_string(),
                        );
                    };

                    let exclusions_file_path = base_dirs
                        .config_dir()
                        .join("com.fitlauncher.carrotrub")
                        .join("fitgirlConfig")
                        .join("settings")
                        .join("data")
                        .join("folder_exclusions.json");

                    let mut file = load_exclusions(&exclusions_file_path);

                    let excluded_path = match &policy {
                        ExclusionCleanupPolicy::Keep(p)
                        | ExclusionCleanupPolicy::RemoveAfterInstall(p) => p.clone(),
                    };

                    match &policy {
                        ExclusionCleanupPolicy::Keep(_) => {}

                        ExclusionCleanupPolicy::RemoveAfterInstall(_) => {
                            file.entries.retain(|e| e.path != excluded_path);
                        }
                    }

                    save_exclusions(&exclusions_file_path, &file)
                        .map_err(|e| format!("Failed to save exclusion file: {e}"))?;

                    info!("Path excluded and saved: {}", excluded_path);
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
