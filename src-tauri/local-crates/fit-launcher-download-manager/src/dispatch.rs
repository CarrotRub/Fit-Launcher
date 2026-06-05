use crate::aria2::Aria2WsClient;
use crate::manager::DownloadManager;
use crate::types::Aria2ConnState;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, sleep};
use tracing::{error, info, warn};

/// Polls aria2 every 500ms; fast-path reconnect when PID disappears.
pub fn spawn_dispatcher(manager: Arc<DownloadManager>, aria: Arc<Mutex<Aria2WsClient>>) {
    tokio::spawn(async move {
        info!("Dispatcher: starting aria2 poll loop");
        let mut last_hash = String::new();
        let mut consecutive_errors: u32 = 0;
        let mut current_state = Aria2ConnState::Reconnecting;
        manager.emit_aria2_status(current_state, None);

        loop {
            if manager.is_empty().await {
                if current_state != Aria2ConnState::Idle {
                    current_state = Aria2ConnState::Idle;
                    manager.emit_aria2_status(current_state, None);
                }
                sleep(Duration::from_millis(500)).await;
                continue;
            }

            // Fast path: skip RPC and respawn immediately when the PID is gone.
            let child_alive = { aria.lock().await.is_child_alive() };
            if !child_alive {
                if current_state != Aria2ConnState::Reconnecting {
                    current_state = Aria2ConnState::Reconnecting;
                    manager.emit_aria2_status(current_state, Some("aria2c process exited".into()));
                }
                warn!("aria2c PID missing, respawning");
                let reconnect_result = {
                    let guard = aria.lock().await;
                    guard.ensure_connected().await
                };
                match reconnect_result {
                    Ok(()) => {
                        info!("Aria2 respawn succeeded");
                        consecutive_errors = 0;
                        current_state = Aria2ConnState::Connected;
                        manager.emit_aria2_status(current_state, None);
                        manager.reconcile_after_reconnect().await;
                    }
                    Err(e) => {
                        error!("Aria2 respawn failed: {:?}", e);
                        if current_state != Aria2ConnState::Disconnected {
                            current_state = Aria2ConnState::Disconnected;
                            manager.emit_aria2_status(current_state, Some(format!("{}", e)));
                        }
                    }
                }
                sleep(Duration::from_millis(500)).await;
                continue;
            }

            let result = {
                let guard = aria.lock().await;
                guard.list_all().await
            };

            match result {
                Ok(statuses) => {
                    consecutive_errors = 0;
                    if current_state != Aria2ConnState::Connected {
                        current_state = Aria2ConnState::Connected;
                        manager.emit_aria2_status(current_state, None);
                    }
                    if let Ok(serialized) = serde_json::to_string(&statuses) {
                        let hash = format!("{:x}", Sha256::digest(serialized.as_bytes()));
                        if hash != last_hash {
                            last_hash = hash;
                            manager.on_aria2_update(statuses).await;
                        }
                    }
                }
                Err(err) => {
                    consecutive_errors += 1;
                    error!(
                        "Aria2 status poll error (consecutive: {}): {:?}",
                        consecutive_errors, err
                    );

                    if consecutive_errors >= 3 {
                        if current_state != Aria2ConnState::Reconnecting {
                            current_state = Aria2ConnState::Reconnecting;
                            manager.emit_aria2_status(current_state, Some(format!("{}", err)));
                        }
                        warn!("Multiple consecutive aria2 poll errors, reconnecting...");
                        let reconnect_result = {
                            let guard = aria.lock().await;
                            guard.ensure_connected().await
                        };
                        match reconnect_result {
                            Ok(()) => {
                                info!("Aria2 reconnect succeeded");
                                consecutive_errors = 0;
                                current_state = Aria2ConnState::Connected;
                                manager.emit_aria2_status(current_state, None);
                                // Respawned daemon has no old gids; prune dead pointers and respawn orphaned jobs.
                                manager.reconcile_after_reconnect().await;
                            }
                            Err(e) => {
                                error!("Aria2 reconnect failed: {:?}", e);
                                if current_state != Aria2ConnState::Disconnected {
                                    current_state = Aria2ConnState::Disconnected;
                                    manager
                                        .emit_aria2_status(current_state, Some(format!("{}", e)));
                                }
                            }
                        }
                    }
                }
            }

            sleep(Duration::from_millis(500)).await;
        }
    });
}
