use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
pub struct TorrentInfo {
    pub id: String,
    pub filename: String,
    pub hash: String,
    pub bytes: u64,
    pub host: String,
    pub split: u32,
    pub progress: f64,
    pub status: String,
    pub added: String,
    pub links: Vec<String>,
    pub ended: Option<String>,
    pub speed: Option<u64>,
    pub seeders: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
pub struct TorrentFile {
    pub id: u32,
    pub path: String,
    pub bytes: u64,
    pub selected: u32,
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
pub struct TorrentFilesResponse {
    pub id: String,
    pub filename: String,
    pub hash: String,
    pub bytes: u64,
    pub host: String,
    pub split: u32,
    pub progress: f64,
    pub status: String,
    pub added: String,
    pub files: Vec<TorrentFile>,
    pub links: Vec<String>,
    pub ended: Option<String>,
    pub speed: Option<u64>,
    pub seeders: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
pub struct AddMagnetResponse {
    pub id: String,
    pub uri: String,
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
pub struct UnrestrictLinkResponse {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub filesize: u64,
    pub link: String,
    pub host: String,
    pub chunks: u32,
    pub crc: u32,
    pub download: String,
    pub streamable: u32,
}

#[derive(Debug, Serialize)]
pub struct SelectFilesRequest {
    pub files: String,
}
