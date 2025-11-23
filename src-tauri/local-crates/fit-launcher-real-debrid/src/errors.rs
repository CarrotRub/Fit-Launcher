use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

#[derive(Debug, Deserialize, Serialize, Type, Error)]
pub enum RealDebridApiError {
    #[error("Authentication error: {0}")]
    AuthenticationError(String),

    #[error("Invalid token")]
    InvalidToken,

    #[error("Rate limit exceeded")]
    RateLimitError,

    #[error("Torrent not found")]
    TorrentNotFound,

    #[error("Torrent processing timeout")]
    TorrentProcessingTimeout,

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid magnet link")]
    InvalidMagnet,

    #[error("API error: {0}")]
    ApiError(String),

    #[error("IO error: {0}")]
    IOError(String),
}

