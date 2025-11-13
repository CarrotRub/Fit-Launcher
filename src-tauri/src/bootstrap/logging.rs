use std::error::Error;
use std::fs;
use tracing::{info, warn};

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
    let (file_writer, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::fmt()
        .with_writer(file_writer)
        .with_ansi(false)
        .with_max_level(tracing::Level::INFO)
        .init();

    warn!("Logging initialized, logs_dir: {}", logs_dir.display());
    info!("init_logging complete");
}
