use serde::Serialize;
use tauri::Emitter;
use tracing::{debug, error, warn};
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
                debug!("Progress loop cancelled at {}%", latest);
                let _ = app_handle.emit("setup::progress::cancelled", JobProgress { id, percentage: latest });
                break;
            }
            res = retry_until_async(400, interval_ms, || async {
                poll_progress_bar_percentage()
            }) => {
                match res {
                    Some(p) => {
                        latest = p;
                        consecutive_none = 0;
                        interval_ms = (interval_ms * 2).min(MAX_INTERVAL_MS);
                    }
                    None => {
                        consecutive_none += 1;
                        warn!("poll_progress_bar_percentage returned None {} times in a row, keeping last value {}", consecutive_none, latest);
                        if consecutive_none >= MAX_NONE {
                            warn!("Too many consecutive None values, stopping progress loop, will try to find completed setup");

                            // Sometimes the progress stops at >80% so we have to add this just in case
                            let completed = find_completed_setup();
                            if completed {
                                    let _ = app_handle.emit(
                                                "setup::progress::finished",
                                                JobProgress { id, percentage: 100.0 },
                                            );
                            } else {
                                let _ = app_handle.emit("setup::progress::cancelled", JobProgress { id, percentage: latest });
                            }
                            break;
                        }
                    }
                }

                debug!("Progress: {}%", latest);

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
