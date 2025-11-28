use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

/// Errors that can occur when interacting with debrid services
#[derive(Debug, Serialize, Deserialize, Type, Error, Clone)]
pub enum DebridError {
    /// The provided API key is invalid or malformed
    #[error("Invalid API key")]
    InvalidApiKey,

    /// The API key is valid but the subscription has expired
    #[error("Subscription expired")]
    SubscriptionExpired,

    /// The user has exceeded their download quota
    #[error("Download quota exceeded")]
    QuotaExceeded,

    /// The provided magnet link is not supported by the service
    #[error("Magnet link not supported by this provider")]
    MagnetNotSupported,

    /// The torrent conversion timed out
    #[error("Conversion timeout after {0} seconds")]
    ConversionTimeout(u64),

    /// The torrent conversion failed on the debrid service
    #[error("Conversion failed: {0}")]
    ConversionFailed(String),

    /// Network error while communicating with the API
    #[error("Network error: {0}")]
    NetworkError(String),

    /// API returned an error response
    #[error("API error (code {code}): {message}")]
    ApiError { code: i32, message: String },

    /// The requested torrent was not found on the debrid service
    #[error("Torrent not found")]
    TorrentNotFound,

    /// The provider is not configured or not found
    #[error("Provider not found: {0}")]
    ProviderNotFound(String),

    /// Rate limit exceeded
    #[error("Rate limit exceeded, retry after {0} seconds")]
    RateLimited(u64),

    /// Generic internal error
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<reqwest::Error> for DebridError {
    fn from(err: reqwest::Error) -> Self {
        DebridError::NetworkError(err.to_string())
    }
}

impl From<serde_json::Error> for DebridError {
    fn from(err: serde_json::Error) -> Self {
        DebridError::InternalError(format!("JSON parsing error: {}", err))
    }
}

