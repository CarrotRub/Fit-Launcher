use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, thiserror::Error, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "type", content = "data")]
pub enum ScrapingError {
    #[error("Failed to extract article: {0}")]
    ArticleNotFound(String),

    #[error("Request error: {0}")]
    ReqwestError(String),

    #[error("Selector parsing error: {0}")]
    SelectorError(String),

    #[error("JSON error: {0}")]
    JsonError(String),

    #[error("General error: {0}")]
    GeneralError(String),

    #[error("HTTP status error: {0}")]
    HttpStatusCodeError(String),

    #[error("Timeout error: {0}")]
    TimeoutError(String),

    #[error("I/O error: {0}")]
    IOError(String),

    #[error("Window error: {0}")]
    WindowError(String),

    #[error("Cookie error: {0}")]
    CookieError(String),

    #[error("URL parse error: {0}")]
    UrlParseError(String),

    #[error("Regex error: {0}")]
    RegexError(String),

    #[error("Semaphore error: {0}")]
    SemaphoreError(String),
}

impl From<reqwest::Error> for ScrapingError {
    fn from(error: reqwest::Error) -> Self {
        ScrapingError::ReqwestError(error.to_string())
    }
}

impl From<serde_json::Error> for ScrapingError {
    fn from(error: serde_json::Error) -> Self {
        ScrapingError::JsonError(error.to_string())
    }
}

impl From<std::io::Error> for ScrapingError {
    fn from(error: std::io::Error) -> Self {
        ScrapingError::IOError(error.to_string())
    }
}

impl From<rusqlite::Error> for ScrapingError {
    fn from(error: rusqlite::Error) -> Self {
        ScrapingError::IOError(error.to_string())
    }
}

impl From<regex::Error> for ScrapingError {
    fn from(error: regex::Error) -> Self {
        ScrapingError::RegexError(error.to_string())
    }
}

impl From<tokio::sync::AcquireError> for ScrapingError {
    fn from(error: tokio::sync::AcquireError) -> Self {
        ScrapingError::SemaphoreError(error.to_string())
    }
}
