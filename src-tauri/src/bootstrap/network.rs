use serde::Serialize;
use tauri::async_runtime::spawn;
use tauri::{AppHandle, Emitter, Listener, Manager};
use tracing::info;

/// Small payload type used for emit
#[derive(Serialize, Clone)]
pub(crate) struct NetworkFailurePayload {
    pub message: String,
}

pub async fn perform_network_request(app_handle: AppHandle) {
    info!(
        "perform_network_request: waiting for frontend-ready before starting the network request."
    );

    if let Some(main_window) = app_handle.get_webview_window("main") {
        let app_handle_clone = app_handle.clone();

        main_window.listen("frontend-ready", move |_| {
            info!("Frontend signalled ready — performing network check");

            let app_handle_inner = app_handle_clone.clone();

            spawn(async move {
                match reqwest::get("https://fitgirl-repacks.site").await {
                    Ok(resp) => {
                        let _ = resp.text().await;
                        info!("perform_network_request: network request successful");
                    }
                    Err(_) => {
                        info!("perform_network_request: request failed, emitting 'network-failure'");

                        let payload = NetworkFailurePayload {
                            message: "There was a network issue, unable to retrieve latest game data. (E01)".to_string(),
                        };

                        let _ = app_handle_inner.emit("network-failure", payload);
                    }
                }
            });
        });
    }
}
