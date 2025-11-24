use std::fmt;

use serde::{Deserialize, Serialize};
use specta::Type;
use unrar::error::UnrarError;

use crate::InstallationError;

// TODO: rust-analyzer/specta+serde false-positive
#[derive(Debug, Type, Deserialize, Serialize)]
pub enum ExtractError {
    Io(String),
    Unrar(String),
    InstallationError(InstallationError),
    NoParentDirectory,
    NoRarFileFound,
}

impl fmt::Display for ExtractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ExtractError::Io(e) => write!(f, "IO error: {e}",),
            ExtractError::InstallationError(e) => write!(f, "Installation error: {e}"),
            ExtractError::Unrar(e) => write!(f, "Unrar error: {e}"),
            ExtractError::NoParentDirectory => write!(f, "Archive path has no parent directory"),
            ExtractError::NoRarFileFound => {
                write!(f, "No rar file was found in the given directory")
            }
        }
    }
}

impl std::error::Error for ExtractError {}

impl From<std::io::Error> for ExtractError {
    fn from(err: std::io::Error) -> Self {
        ExtractError::Io(err.to_string())
    }
}

impl From<UnrarError> for ExtractError {
    fn from(err: UnrarError) -> Self {
        ExtractError::Unrar(err.to_string())
    }
}

impl From<InstallationError> for ExtractError {
    fn from(err: InstallationError) -> Self {
        ExtractError::InstallationError(err)
    }
}
