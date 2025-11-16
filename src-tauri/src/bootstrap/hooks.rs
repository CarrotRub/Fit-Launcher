use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use fit_launcher_torrent::functions::TorrentSession;
use tauri::{AppHandle, Manager};
use tokio::signal;
use tracing::{error, info};

pub fn shutdown_hook(app_handle: AppHandle) {
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        let _ = tokio::signal::ctrl_c().await;
        info!("Ctrl-C received: shutting down TorrentSession...");
        if let Some(session) = app_handle_clone.try_state::<TorrentSession>() {
            session.shutdown().await;
        }
        std::process::exit(0);
    });
}
