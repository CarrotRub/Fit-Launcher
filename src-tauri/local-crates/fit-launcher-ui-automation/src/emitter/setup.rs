use tauri::Emitter;
use tracing::{debug, error};

use crate::mighty::automation::win32::poll_progress_bar_percentage;

/// Runs a loop that emits progress updates
///
/// Handles cancellation and logging
pub async fn progress_bar_setup_emit(
    app_handle: tauri::AppHandle,
    cancel: tokio_util::sync::CancellationToken,
) -> f32 {
    let mut latest: f32 = 0.0;

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                debug!("Progress loop cancelled at {}%", latest);
                let _ = app_handle.emit("setup::progress::cancelled", latest);
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_millis(400)) => {
                if let Some(p) = poll_progress_bar_percentage() {
                    latest = p;
                }

                debug!("Progress: {}%", latest);

                if let Err(e) = app_handle.emit("setup::progress::updated", latest) {
                    error!("Failed to emit progress: {:?}", e);
                }

                if latest >= 100.0 {
                    let _ = app_handle.emit("setup::progress::finished", latest);
                    break;
                }
            }
        }
    }

    latest
}
