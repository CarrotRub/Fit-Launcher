//! Internal Real-Debrid API response types.

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AddTorrentResponse {
    pub id: String,
}

/// Status values: magnet_error, magnet_conversion, waiting_files_selection, queued,
/// downloading, downloaded, error, virus, compressing, uploading, dead
#[derive(Debug, Clone, Deserialize)]
pub struct TorrentInfo {
    pub filename: String,
    pub hash: String,
    pub bytes: u64,
    pub progress: f64,
    pub status: String,
    #[serde(default)]
    pub files: Vec<RealDebridFile>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub speed: Option<u64>,
    #[serde(default)]
    pub seeders: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TorrentItem {
    pub id: String,
    pub filename: String,
    pub hash: String,
    pub bytes: u64,
    pub host: String,
    pub split: u64,
    pub progress: f64,
    pub status: String,
    pub added: String,
    pub links: Vec<String>,
    #[serde(default)]
    pub ended: Option<String>,
    #[serde(default)]
    pub speed: Option<u64>,
    #[serde(default)]
    pub seeders: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RealDebridFile {
    pub id: u64,
    pub path: String,
    pub bytes: u64,
    pub selected: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UnrestrictResponse {
    pub filename: String,
    pub filesize: u64,
    pub download: String,
}
