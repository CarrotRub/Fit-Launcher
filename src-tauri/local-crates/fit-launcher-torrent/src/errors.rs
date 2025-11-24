use fit_launcher_ui_automation::InstallationError;
use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

#[derive(Debug, Deserialize, Serialize, Type, Error)]
pub enum TorrentApiError {
    #[error("Error getting the Api from the Config")]
    ApiConfigError(String),

    #[error("Could not get config")]
    ConfigRetrievalError,

    #[error("App is not in admin mod")]
    AdminModeError,

    #[error("aria2 error: {0}")]
    Aria2StartupError(String),

    #[error("Error while configuring file: {0}")]
    ConfigurationError(String),

    #[error("Error Initializing Torrent Folder: {0}")]
    InitError(String),

    #[error("IO Error: {0}")]
    IOError(String),

    #[error("Librqbit Error")]
    LibrqbitError,

    #[error("Metadata Error")]
    MetadataError,

    #[error("Torrent Not Found")]
    TorrentNotFound,

    #[error("Invalid Magnet")]
    InvalidMagnet,

    #[error("Unexpected Torrent State")]
    UnexpectedTorrentState,

    #[error("Configuration is trying to be changed during download")]
    ConfigChangeDuringDownload,
}

impl From<InstallationError> for TorrentApiError {
    fn from(value: InstallationError) -> Self {
        match value {
            InstallationError::IOError(io) => TorrentApiError::IOError(io),
            InstallationError::AdminModeError => TorrentApiError::AdminModeError,
        }
    }
}
