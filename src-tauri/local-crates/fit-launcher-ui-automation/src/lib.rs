#[cfg(windows)]
pub mod controller_client;
#[cfg(windows)]
pub mod controller_manager;
pub mod emitter;
pub mod extraction;

#[cfg(windows)]
pub mod defender;

pub mod mighty_commands;
pub mod process_utils;
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

#[cfg(windows)]
fn encode_utf16le_with_null(s: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    s.as_ref().encode_wide().chain(std::iter::once(0)).collect()
}
