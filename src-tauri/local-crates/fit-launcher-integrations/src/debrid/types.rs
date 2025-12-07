//! Unified debrid types used by all providers and frontend.

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum DebridProvider {
    TorBox,
    RealDebrid,
    AllDebrid,
}

impl std::fmt::Display for DebridProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DebridProvider::TorBox => write!(f, "TorBox"),
            DebridProvider::RealDebrid => write!(f, "RealDebrid"),
            DebridProvider::AllDebrid => write!(f, "AllDebrid"),
        }
    }
}

impl DebridProvider {
    pub fn all() -> Vec<DebridProvider> {
        vec![
            DebridProvider::TorBox,
            DebridProvider::RealDebrid,
            DebridProvider::AllDebrid,
        ]
    }

    pub fn info(&self) -> DebridProviderInfo {
        match self {
            DebridProvider::TorBox => DebridProviderInfo {
                id: *self,
                name: "TorBox".to_string(),
                description: "Premium debrid service with instant cached downloads".to_string(),
                website: "https://torbox.app".to_string(),
                color: "emerald".to_string(),
                is_implemented: true,
                supports_cache_check: true,
            },
            DebridProvider::RealDebrid => DebridProviderInfo {
                id: *self,
                name: "Real-Debrid".to_string(),
                description: "Popular unrestricted downloader service".to_string(),
                website: "https://real-debrid.com".to_string(),
                color: "blue".to_string(),
                is_implemented: true,
                supports_cache_check: true,
            },
            DebridProvider::AllDebrid => DebridProviderInfo {
                id: *self,
                name: "AllDebrid".to_string(),
                description: "Multi-hoster and torrent caching service".to_string(),
                website: "https://alldebrid.com".to_string(),
                color: "purple".to_string(),
                is_implemented: false,
                supports_cache_check: false,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridProviderInfo {
    pub id: DebridProvider,
    pub name: String,
    pub description: String,
    pub website: String,
    pub color: String,
    pub is_implemented: bool,
    pub supports_cache_check: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridCacheStatus {
    pub is_cached: bool,
    pub name: Option<String>,
    pub size: Option<u64>,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridFile {
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridTorrentInfo {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub hash: String,
    pub files: Vec<DebridFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridTorrentStatus {
    pub id: String,
    pub status: String,
    pub is_ready: bool,
    pub progress: f64,
    pub speed: Option<u64>,
    pub seeders: Option<u32>,
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridDirectLink {
    pub url: String,
    pub filename: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, thiserror::Error)]
pub enum DebridError {
    #[error("Invalid or missing API key")]
    InvalidApiKey,

    #[error("Torrent not cached on provider")]
    NotCached,

    #[error("Rate limited by provider")]
    RateLimited,

    #[error("Provider API error: {0}")]
    ApiError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Provider not configured")]
    NotConfigured,
}
