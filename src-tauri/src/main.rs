// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
pub mod utils;

pub mod bootstrap;
pub(crate) mod game_info;
pub(crate) mod image_colors;

use crate::bootstrap::{init_logging, start_app};
use tracing::warn;

pub use crate::game_info::*;
pub use crate::image_colors::*;
pub use crate::utils::*;

#[tokio::main]
async fn main() {
    init_logging();

    warn!("Starting application (bootstrap)");

    if let Err(e) = start_app().await {
        eprintln!("Failed to start application: {:#?}", e);
    }
}
