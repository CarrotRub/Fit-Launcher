use serde::Serialize;
use tauri::Emitter;
use tracing::{debug, error, warn};
use uuid::Uuid;

use crate::mighty::automation::win32::poll_progress_bar_percentage;

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

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                debug!("Progress loop cancelled at {}%", latest);
                let _ = app_handle.emit("setup::progress::cancelled", JobProgress { id, percentage: latest });
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_millis(400)) => {
                if let Some(p) = poll_progress_bar_percentage() {
                    latest = p;
                } else {
                    warn!("poll_progress_bar_percentage returned None, keeping last value {}", latest);
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
