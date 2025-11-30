use std::time::Duration;

use serde::Serialize;
use tauri::Emitter;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::mighty::{
    automation::win32::{find_completed_setup, poll_progress_bar_percentage},
    retry_until_async,
};

#[derive(Serialize, Clone)]
pub struct JobProgress {
    pub id: Uuid,
    pub percentage: f32,
}

/// Emits progress updates via Tauri events
pub async fn progress_bar_setup_emit(
    app_handle: tauri::AppHandle,
    cancel: tokio_util::sync::CancellationToken,
    id: Uuid,
) {
    let mut latest: f32 = 0.0;
    let mut interval_ms = 50;
    let mut consecutive_none = 0;
    const MAX_NONE: u32 = 5;
    const MAX_INTERVAL_MS: u64 = 500;

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                let _ = app_handle.emit(
                    "setup::progress::cancelled",
                    JobProgress { id, percentage: latest }
                );
                break;
            }

            _ = tokio::time::sleep(Duration::from_millis(interval_ms)) => {
                let mut attempts = 0;


                let mut value = None;

                while attempts < MAX_NONE {
                    if let Some(p) = poll_progress_bar_percentage() {
                        value = Some(p);
                        break;
                    }

                    attempts += 1;
                    tokio::time::sleep(Duration::from_millis(interval_ms)).await;
                }

                match value {
                    Some(p) => {
                        latest = p;
                        consecutive_none = 0;
                    }
                    None => {
                        consecutive_none += 1;
                        if consecutive_none >= MAX_NONE {
                            // completed setup fallback
                            let completed = find_completed_setup();
                            if completed {
                                let _ = app_handle.emit(
                                    "setup::progress::finished",
                                    JobProgress { id, percentage: 100.0 },
                                );
                            } else {
                                let _ = app_handle.emit(
                                    "setup::progress::cancelled",
                                    JobProgress { id, percentage: latest },
                                );
                            }
                            break;
                        }
                    }
                }

                // emit always
                let _ = app_handle.emit(
                    "setup::progress::updated",
                    JobProgress { id, percentage: latest },
                );

                if latest >= 100.0 {
                    let _ = app_handle.emit(
                        "setup::progress::finished",
                        JobProgress { id, percentage: latest },
                    );
                    break;
                }
            }
        }
    }
}
