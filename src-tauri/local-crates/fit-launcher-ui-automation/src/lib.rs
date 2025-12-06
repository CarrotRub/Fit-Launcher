pub mod emitter;
pub mod extraction;
pub mod mighty;
pub mod mighty_automation;
pub mod mighty_commands;
pub mod process_utils;
pub mod winevents;
use std::time::Duration;

pub use extraction::*;
pub use mighty_commands::*;
pub use process_utils::*;
use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;
use tokio_util::sync::CancellationToken;

pub mod api;

pub async fn cancel_safe_sleep(ms: u64, cancel: &CancellationToken) {
    tokio::select! {
        _ = tokio::time::sleep(Duration::from_millis(ms)) => {}
        _ = cancel.cancelled() => {}
    }
}

#[derive(Debug, Deserialize, Serialize, Type, Error)]
pub enum InstallationError {
    #[error("IO Error: {0}")]
    IOError(String),

    #[error("App is not in admin mod")]
    AdminModeError,
}
