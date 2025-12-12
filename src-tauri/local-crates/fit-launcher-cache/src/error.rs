use std::fmt::Display;

use lru_cache_adaptor::LRUError;
use specta::Type;

#[derive(Debug, Type, serde::Serialize)]
pub enum CacheError {
    LRU(String),
}

impl From<LRUError> for CacheError {
    fn from(value: LRUError) -> Self {
        Self::LRU(value.to_string())
    }
}

impl Display for CacheError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::LRU(e) => f.write_fmt(format_args!("lru: {e}")),
        }
    }
}
