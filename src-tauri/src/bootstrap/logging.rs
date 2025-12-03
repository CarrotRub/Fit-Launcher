use once_cell::sync::OnceCell;
use std::error::Error;
use std::fs;
use tracing::{info, warn};
use tracing_subscriber::{EnvFilter, prelude::*};

static LOG_GUARD: once_cell::sync::OnceCell<tracing_appender::non_blocking::WorkerGuard> =
    OnceCell::new();

pub fn init_logging() {
    let logs_dir = directories::BaseDirs::new()
        .expect("Could not determine base directories")
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("logs");

    let settings_dir = directories::BaseDirs::new()
        .expect("Could not determine base directories")
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("fitgirlConfig");

    if let Err(e) = fs::create_dir_all(&logs_dir) {
        eprintln!("Failed to create logs dir {:?}: {:?}", logs_dir, e);
    }
    if let Err(e) = fs::create_dir_all(&settings_dir) {
        eprintln!("Failed to create settings dir {:?}: {:?}", settings_dir, e);
    }

    let file_appender = tracing_appender::rolling::never(&logs_dir, "app.log");
    let (file_writer, guard) = tracing_appender::non_blocking(file_appender);
    LOG_GUARD.set(guard).unwrap();

    // Filter to reduce spam from aria2_ws websocket reconnection attempts
    let filter = EnvFilter::new("info").add_directive("aria2_ws=warn".parse().unwrap());

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(file_writer)
                .with_ansi(false),
        )
        .with(filter)
        .try_init()
        .unwrap_or_else(|_| {
            eprintln!("Global tracing subscriber already set");
        });

    info!("Logging initialized, logs_dir: {}", logs_dir.display());
    info!("init_logging complete");
}
