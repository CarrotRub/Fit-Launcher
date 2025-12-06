//! Internal TorBox API response types.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct TorBoxResponse<T> {
    pub success: bool,
    pub detail: String,
    pub data: T,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CachedTorrent {
    pub name: String,
    pub size: u64,
    pub hash: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateTorrentData {
    pub torrent_id: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TorBoxTorrent {
    pub id: u64,
    pub hash: String,
    pub name: String,
    pub size: u64,
    #[serde(default)]
    pub files: Vec<TorBoxFile>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TorBoxFile {
    pub id: u64,
    pub name: String,
    pub short_name: String,
    pub size: u64,
}
