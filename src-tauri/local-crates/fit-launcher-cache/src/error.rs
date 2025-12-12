use lru_cache_adaptor::LRUError;
use specta::Type;

#[derive(Debug, Type, serde::Serialize, thiserror::Error)]
pub enum CacheError {
    #[error("lru: {0}")]
    LRU(String),
    #[error("reqwest: {0}")]
    Reqwest(String),
    #[error("kanal: {0}")]
    Kanal(String),
    #[error("io: {0}")]
    IO(String),
    #[error("cache missing")]
    CacheMissing,
    #[error("mime guess failed")]
    MimeGuess,
}

impl From<kanal::ReceiveError> for CacheError {
    fn from(value: kanal::ReceiveError) -> Self {
        Self::Kanal(value.to_string())
    }
}

impl From<kanal::SendError> for CacheError {
    fn from(value: kanal::SendError) -> Self {
        Self::Kanal(value.to_string())
    }
}

impl From<std::io::Error> for CacheError {
    fn from(value: std::io::Error) -> Self {
        Self::IO(value.to_string())
    }
}

impl From<reqwest::Error> for CacheError {
    fn from(value: reqwest::Error) -> Self {
        Self::Reqwest(value.to_string())
    }
}

impl From<LRUError> for CacheError {
    fn from(value: LRUError) -> Self {
        Self::LRU(value.to_string())
    }
}
