pub mod mighty;
pub mod mighty_automation;
pub mod mighty_commands;

pub use mighty_commands::*;
use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

#[derive(Debug, Deserialize, Serialize, Type, Error)]
pub enum InstallationError {
    #[error("IO Error: {0}")]
    IOError(String),

    #[error("App is not in admin mod")]
    AdminModeError,
}
