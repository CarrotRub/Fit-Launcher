use std::path::PathBuf;

use fit_launcher_scraping::structs::Game;
use tauri::async_runtime::spawn_blocking;
use tokio_util::sync::CancellationToken;
use tracing::error;
use uuid::Uuid;

use crate::InstallationError;

#[derive(Clone)]
pub struct InstallationJob {
    pub id: Uuid,
    /// The original download ID from the download manager.
    /// Used to clean up pending_downloads when installation starts.
    pub download_id: Option<Uuid>,
    pub cancel_emitter: CancellationToken,
    pub game: Game,
    pub path: PathBuf,
}

impl InstallationJob {
    /// returns relative path from game installation directory,
    /// to the game main executable or the launcher.
    pub async fn find_main_executable(&self) -> Option<String> {
        let setup = self.setup_executable_path();

        let result: Result<anyhow::Result<_>, _> = spawn_blocking(move || {
            let file = std::fs::OpenOptions::new()
                .read(true)
                .create(false)
                .open(&setup)?;
            let inno = inno::Inno::new(file).inspect_err(|e| {
                error!("failed to parse {setup:?}: {e}");
            })?;

            let icon = inno
                .icons()
                .iter()
                .filter(|icon| {
                    icon.name()
                        .is_some_and(|name| name.starts_with("{commondesktop}"))
                })
                .filter_map(|icon| icon.file())
                .next();
            let run = inno
                .run_entries()
                .iter()
                .filter(|entry| {
                    entry
                        .description()
                        .is_some_and(|desc| desc.starts_with("{cm:LaunchProgram,"))
                })
                .filter_map(|entry| entry.name())
                .next();

            Ok(icon.or(run).map(|s| s.replace("{app}\\", "")))
        })
        .await;

        result.ok().and_then(|res| res.ok()).and_then(|path| path)
    }

    pub fn setup_executable_path(&self) -> PathBuf {
        let mut setup_executable_path = self.path.join("setup.exe");

        for fixed in ["setup-fixed-ost.exe", "setup-FIXED.exe"] {
            let fixed_setup = self.path.join(fixed);
            if fixed_setup.exists() {
                setup_executable_path = fixed_setup;
            }
        }

        setup_executable_path
    }

    #[cfg_attr(not(windows), allow(unused))]
    pub async fn auto_installation(
        &self,
        app_handle: tauri::AppHandle,
        id: Uuid,
    ) -> Result<(), crate::InstallationError> {
        #[cfg(target_os = "windows")]
        {
            use std::time::Duration;
            use tauri::Emitter;
            use tracing::{error, info, warn};

            use crate::controller_client::{ControllerCommand, ControllerEvent, InstallOptions};
            use crate::controller_manager::{ControllerManager, QueuedInstallJob};
            use fit_launcher_config::commands::get_installation_settings;
            use fit_launcher_scraping::db::extract_slug;

            let setup_path = self.setup_executable_path();
            info!("Setup path: {}", setup_path.display());

            // Install path: user's install folder (parent of download folder) + game slug
            // Download folder is UUID to avoid unicode issues, but install folder uses slug
            let slug = extract_slug(&self.game.href);
            let install_folder = self.path.parent().unwrap_or(&self.path);
            let install_path = install_folder.join(&slug).to_string_lossy().to_string();

            info!("Install path: {}", install_path);

            // Get installation settings
            let settings = get_installation_settings();
            let options = InstallOptions {
                two_gb_limit: settings.two_gb_limit,
                install_directx: settings.directx_install,
                install_vcredist: settings.microsoftcpp_install,
            };

            let job_id_str = id.to_string();
            let manager = ControllerManager::global();

            // 1. Queue the installation
            let queued_job = QueuedInstallJob {
                job_id: id,
                download_id: self.download_id,
                slug: slug.clone(),
                setup_path: setup_path.clone(),
                install_path: install_path.clone(),
                options: options.clone(),
            };

            if let Err(e) = manager.queue_install(queued_job) {
                error!("Failed to queue install: {}", e);
                return Err(crate::InstallationError::IOError(e));
            }

            // Notify frontend that queue state changed (download moved to install queue)
            let _ = app_handle.emit("install::queue::changed", ());

            // 2. Wait for our turn
            let cancel_token = self.cancel_emitter.clone();
            loop {
                if cancel_token.is_cancelled() {
                    info!("Installation cancelled while in queue");
                    let _ = manager.cancel_download(id);
                    return Err(crate::InstallationError::IOError("Cancelled".to_string()));
                }

                match manager.take_next_job_if_match(id) {
                    Ok(true) => {
                        info!("It is our turn to install!");
                        break;
                    }
                    Ok(false) => {
                        // Not our turn or busy, wait
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                    Err(e) => {
                        error!("Error checking queue: {}", e);
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }

            // 3. Start Installation (we are now the 'current_install')
            // Ensure controller is running (reusing existing if alive)
            if let Err(e) = manager.ensure_running() {
                let _ = manager.complete_current_install();
                return Err(crate::InstallationError::IOError(format!(
                    "Failed to start controller: {}",
                    e
                )));
            }

            // Send Start command
            if let Err(e) = manager.send_command(&ControllerCommand::StartInstall {
                job_id: job_id_str.clone(),
                setup_path: setup_path.to_string_lossy().to_string(),
                install_path: install_path.clone(),
                options,
            }) {
                let _ = manager.complete_current_install();
                let _ = manager.shutdown_if_idle();
                return Err(crate::InstallationError::IOError(format!(
                    "Failed to send start command: {}",
                    e
                )));
            }

            info!("Installation command sent, monitoring events...");

            // Emit hook started event for frontend
            let _ = app_handle.emit(
                "setup::hook::started",
                serde_json::json!({ "id": job_id_str.clone(), "success": true }),
            );

            // Monitor events and emit to Tauri
            let mut success = false;
            let mut install_path_received: Option<String> = None;

            // Idle timeout detection - if no events for 60s, installation is frozen
            let mut last_event_time = std::time::Instant::now();
            let idle_timeout = Duration::from_secs(60);

            loop {
                // Check for cancellation
                if cancel_token.is_cancelled() {
                    info!("Installation cancelled by user");
                    let _ = manager.send_command(&ControllerCommand::CancelInstall {
                        job_id: job_id_str.clone(),
                    });
                    // We don't break immediately, we wait for Completed/Error event from controller handling cancel
                    // But if controller is stuck, we might need to force break.
                    // For now, let's assume controller responds to cancel.
                }

                // Check for idle timeout (frozen installer)
                if last_event_time.elapsed() > idle_timeout {
                    error!("Installation appears frozen (no events for 60s), aborting...");
                    let _ = manager.send_command(&ControllerCommand::CancelInstall {
                        job_id: job_id_str.clone(),
                    });
                    let _ = app_handle.emit(
                        "setup::progress::error",
                        "Installation appears frozen and was aborted",
                    );
                    break;
                }

                // Take client out to avoid holding mutex during blocking I/O
                // This prevents other operations (queue_install, etc) from being blocked
                let taken_client = manager.take_client();
                let recv_result = match taken_client {
                    Ok(Some(mut client)) => {
                        // Do blocking recv in spawn_blocking without holding the manager's mutex
                        let res = tokio::task::spawn_blocking(move || {
                            let result = client.recv_timeout(Duration::from_millis(500));
                            (client, result)
                        })
                        .await
                        .map_err(|e| format!("spawn_blocking error: {}", e));

                        match res {
                            Ok((client_back, result)) => {
                                // Put client back regardless of recv result
                                let _ = manager.put_client(client_back);
                                result.map_err(|e| e.to_string())
                            }
                            Err(e) => Err(e),
                        }
                    }
                    Ok(None) => Err("Controller not connected".to_string()),
                    Err(e) => Err(e),
                };

                match recv_result {
                    Ok(Some(event)) => {
                        // Reset idle timer on any event
                        last_event_time = std::time::Instant::now();

                        match &event {
                            ControllerEvent::Progress { job_id, percent } => {
                                if *job_id == job_id_str {
                                    let _ = app_handle.emit("setup::progress::percent", percent);
                                }
                            }
                            ControllerEvent::Phase { job_id, phase } => {
                                if *job_id == job_id_str {
                                    let _ = app_handle
                                        .emit("setup::progress::phase", format!("{:?}", phase));
                                }
                            }
                            ControllerEvent::File { job_id, path } => {
                                if *job_id == job_id_str {
                                    let _ = app_handle.emit("setup::progress::file", path);
                                }
                            }
                            ControllerEvent::GameTitle { job_id, title } => {
                                if *job_id == job_id_str {
                                    let _ = app_handle.emit("setup::progress::title", title);
                                }
                            }
                            ControllerEvent::Completed {
                                job_id,
                                success: ok,
                                install_path,
                                error,
                            } => {
                                if *job_id == job_id_str {
                                    success = *ok;
                                    install_path_received = install_path.clone();
                                    if success {
                                        info!("Installation completed successfully");
                                        let _ = app_handle
                                            .emit("setup::progress::finished", &install_path);
                                    } else {
                                        let msg = error.as_deref().unwrap_or("Unknown error");
                                        error!("Installation failed: {}", msg);
                                        let _ = app_handle.emit("setup::progress::error", msg);
                                    }
                                    break;
                                }
                            }
                            ControllerEvent::Error { job_id, message } => {
                                // Some errors might be global or specific
                                if job_id.as_deref() == Some(&job_id_str) || job_id.is_none() {
                                    error!("Controller error: {}", message);
                                    let _ = app_handle.emit("setup::progress::error", message);
                                    break;
                                }
                            }
                            ControllerEvent::ShuttingDown => {
                                info!("Controller shutting down unexpectedly");
                                break;
                            }
                            _ => {}
                        }
                    }
                    Ok(None) => {
                        // Timeout, continue loop
                    }
                    Err(e) => {
                        error!("Controller connection error: {:#}", e);
                        break;
                    }
                }
            }

            // Cleanup
            let _ = manager.complete_current_install();
            let _ = manager.shutdown_if_idle(); // Will kill process if no other jobs in queue

            // Post-installation finalization: find main executable
            if success && let Some(ref path) = install_path_received {
                info!("Finalizing installation: locating main executable...");
                // We run this async block logic here as before
                if let Some(exe_path) = self.find_main_executable().await {
                    // Note: find_main_executable is async on &self
                    info!("Main executable found: {}", exe_path);
                    let full_exe_path = format!("{}\\{}", path, exe_path);
                    let _ = app_handle.emit("setup::progress::executable", &full_exe_path);
                } else {
                    warn!("Could not locate main executable");
                }
            }

            // Emit hook stopped event for frontend
            let _ = app_handle.emit(
                "setup::hook::stopped",
                serde_json::json!({
                    "id": job_id_str,
                    "success": success,
                    "install_path": install_path_received.clone()
                }),
            );

            if success {
                Ok(())
            } else if cancel_token.is_cancelled() {
                Err(crate::InstallationError::IOError(
                    "Installation was cancelled".to_string(),
                ))
            } else {
                Err(crate::InstallationError::IOError(
                    "Installation did not complete successfully".to_string(),
                ))
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            use tracing::info;

            info!("Automated setup installation is not supported on this platform");
            Err(InstallationError::IOError(
                "Automated setup installation is not supported on this platform".to_string(),
            ))
        }
    }

    pub async fn clean_parts(&self) -> Result<(), crate::InstallationError> {
        #[cfg(target_os = "windows")]
        {
            use tokio::fs;

            let mut attempts = 0;
            let path = self.path.clone();
            loop {
                match fs::remove_dir_all(path.clone()).await {
                    Ok(_) => return Ok(()),
                    Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied && attempts < 20 => {
                        // Folder still locked by Windows

                        use std::time::Duration;
                        attempts += 1;
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        continue;
                    }
                    Err(e) => return Err(InstallationError::IOError(e.to_string())),
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(())
        }
    }
}
