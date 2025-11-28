use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

#[derive(Debug, Deserialize, Serialize, Clone, Type, Error)]
pub enum DownloadManagerError {
    #[error("Error initializing DDL job: {0}")]
    DdlInitError(String),

    #[error("Error initializing Torrent job: {0}")]
    TorrentInitError(String),

    #[error("Aria2 RPC error: {0}")]
    Aria2RpcError(String),

    #[error("Persistence error: {0}")]
    PersistenceError(String),

    #[error("Job not found: {0}")]
    JobNotFound(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("Internal manager failure: {0}")]
    Internal(String),

    #[error("I/O error: {0}")]
    IoError(String),

    #[error("Debrid conversion failed: {0}")]
    DebridConversionFailed(String),

    #[error("Debrid conversion timed out")]
    DebridConversionTimeout,

    #[error("Debrid provider not found: {0}")]
    DebridProviderNotFound(String),
}
