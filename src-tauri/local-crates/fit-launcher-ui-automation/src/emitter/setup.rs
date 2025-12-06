use std::sync::mpsc::RecvTimeoutError;
use std::time::Duration;

use serde::Serialize;
use tauri::Emitter;
use tracing::{debug, info, warn};
use uuid::Uuid;

#[cfg(target_os = "windows")]
use crate::winevents::win_events::{
    InstallEvent, InstallPhase, mark_hook_failed, monitor_install_events_with_handle, stop_monitor,
};

use crate::mighty::automation::win32::{find_completed_setup, kill_process_by_pid};

#[derive(Serialize, Clone)]
pub struct JobProgress {
    pub id: Uuid,
    pub percentage: f32,
}

#[derive(Serialize, Clone, Debug)]
pub struct PhaseUpdate {
    pub id: Uuid,
    pub phase: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct FileUpdate {
    pub id: Uuid,
    pub path: String,
}

/// Uses SetWinEventHook instead of polling - events fire as window titles change.
/// If installer_pid is provided, only monitors that specific process.
#[cfg(target_os = "windows")]
pub async fn progress_bar_setup_emit(
    app_handle: tauri::AppHandle,
    cancel: tokio_util::sync::CancellationToken,
    id: Uuid,
    install_path: Option<String>,
    installer_pid: Option<u32>,
    root_pid: Option<u32>,
) -> bool {
    let mut latest: f32 = 0.0;
    let mut current_phase: Option<InstallPhase> = None;
    let mut no_event_count = 0;
    const MAX_NO_EVENTS: u32 = 120;

    let target_pid = installer_pid.unwrap_or(0);
    let rx = match monitor_install_events_with_handle(
        app_handle.clone(),
        id,
        target_pid,
        install_path,
    ) {
        Ok(rx) => rx,
        Err(e) => {
            warn!(
                "Failed to start event monitor: {}. Falling back to completion check.",
                e
            );
            return false;
        }
    };

    info!(
        "Started event-driven progress monitoring for job {} (PID: {})",
        id, target_pid
    );

    let mut setup_pid: Option<u32> = installer_pid;

    loop {
        if cancel.is_cancelled() {
            info!("Installation cancelled by user");
            mark_hook_failed();
            stop_monitor();
            return false;
        }

        match rx.recv_timeout(Duration::from_millis(500)) {
            Ok(event) => {
                no_event_count = 0;

                match event {
                    InstallEvent::Phase { phase } => {
                        if current_phase.as_ref() != Some(&phase) {
                            let phase_name = format!("{:?}", phase);
                            info!("Phase changed to: {:?}", phase);
                            current_phase = Some(phase.clone());

                            let _ = app_handle.emit(
                                "setup::phase::updated",
                                PhaseUpdate {
                                    id,
                                    phase: phase_name,
                                },
                            );

                            // Finalizing phase - poll for success text to determine outcome
                            if matches!(phase, InstallPhase::Finalizing) {
                                info!("Detected Finalizing phase, checking for success...");
                                // Give it a moment for the window content to update
                                std::thread::sleep(Duration::from_millis(500));

                                if find_completed_setup() {
                                    info!(
                                        "Installation completed successfully (found success text)"
                                    );
                                    // Kill child process first, then root process
                                    if let Some(child_pid) = installer_pid {
                                        kill_process_by_pid(child_pid);
                                    }
                                    if let Some(parent_pid) = root_pid {
                                        kill_process_by_pid(parent_pid);
                                    }
                                    stop_monitor();
                                    return true;
                                } else {
                                    warn!(
                                        "Installation failed (no success text found in finalizing screen)"
                                    );
                                    mark_hook_failed();
                                    if let Some(child_pid) = installer_pid {
                                        kill_process_by_pid(child_pid);
                                    }
                                    if let Some(parent_pid) = root_pid {
                                        kill_process_by_pid(parent_pid);
                                    }
                                    stop_monitor();
                                    return false;
                                }
                            }

                            if matches!(phase, InstallPhase::Completed) {
                                info!(
                                    "Installation completed successfully, terminating installer processes"
                                );
                                // Kill child process first, then root process
                                if let Some(child_pid) = installer_pid {
                                    kill_process_by_pid(child_pid);
                                }
                                if let Some(parent_pid) = root_pid {
                                    kill_process_by_pid(parent_pid);
                                }
                                stop_monitor();
                                return true;
                            }

                            if matches!(phase, InstallPhase::Failed) {
                                warn!("Installation failed");
                                mark_hook_failed();
                                stop_monitor();
                                return false;
                            }
                        }
                    }

                    InstallEvent::Progress { percent } => {
                        latest = percent;
                        debug!("Progress: {:.1}%", percent);

                        let _ = app_handle.emit(
                            "setup::progress::updated",
                            JobProgress {
                                id,
                                percentage: percent,
                            },
                        );
                    }

                    InstallEvent::File { path } => {
                        debug!("Extracting: {}", path);
                        let _ = app_handle.emit("setup::file::updated", FileUpdate { id, path });
                    }

                    InstallEvent::GameTitle { title } => {
                        debug!("Game title detected: {}", title);

                        if current_phase.as_ref() != Some(&InstallPhase::Welcome) {
                            current_phase = Some(InstallPhase::Welcome);
                            let _ = app_handle.emit(
                                "setup::phase::updated",
                                PhaseUpdate {
                                    id,
                                    phase: "Welcome".to_string(),
                                },
                            );
                        }
                    }

                    InstallEvent::Closed => {
                        info!("Setup window closed");
                        if latest >= 100.0 || matches!(current_phase, Some(InstallPhase::Completed))
                        {
                            stop_monitor();
                            return true;
                        } else {
                            mark_hook_failed();
                            stop_monitor();
                            return false;
                        }
                    }

                    InstallEvent::InstallPath { .. }
                    | InstallEvent::Components { .. }
                    | InstallEvent::DiskSpace { .. } => {}
                }
            }

            Err(RecvTimeoutError::Timeout) => {
                no_event_count += 1;

                if no_event_count >= MAX_NO_EVENTS {
                    info!(
                        "No events for {} seconds, checking if setup completed...",
                        MAX_NO_EVENTS / 2
                    );

                    if find_completed_setup() {
                        info!("Found completed setup window");
                        stop_monitor();
                        return true;
                    } else {
                        warn!("Setup appears to have stalled or closed unexpectedly");
                        if let Some(pid) = setup_pid {
                            kill_process_by_pid(pid);
                        }

                        mark_hook_failed();
                        stop_monitor();
                        return false;
                    }
                }
            }

            Err(RecvTimeoutError::Disconnected) => {
                info!("Event monitor channel disconnected");
                if latest >= 100.0 || find_completed_setup() {
                    return true;
                } else {
                    mark_hook_failed();
                    return false;
                }
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub async fn progress_bar_setup_emit(
    _app_handle: tauri::AppHandle,
    _cancel: tokio_util::sync::CancellationToken,
    _id: Uuid,
    _install_path: Option<String>,
    _installer_pid: Option<u32>,
    _root_pid: Option<u32>,
) -> bool {
    warn!("Event-driven progress monitoring is only supported on Windows");
    false
}
