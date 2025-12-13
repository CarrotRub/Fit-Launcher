use std::{path::PathBuf, sync::Arc};

use directories::BaseDirs;
use fit_launcher_scraping::db;
use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, ListOnlyResponse, Magnet, Session,
    api::TorrentIdOrHash,
};
use tokio::io::AsyncWriteExt;
use tracing::{error, info};

use crate::{decrypt_torrent_from_paste, errors::TorrentApiError};

#[derive(Clone)]
pub struct LibrqbitSession {
    session: Arc<Session>,
}

impl LibrqbitSession {
    pub async fn new() -> Self {
        let session = Session::new("/temp/".into())
            .await
            .expect("Failed to start Session");
        Self { session }
    }

    pub async fn get_metadata_only(
        &self,
        magnet_str: String,
    ) -> Result<ListOnlyResponse, TorrentApiError> {
        let (add, torrent_path) = get_add_torrent(&magnet_str).await?;

        let response = self
            .session
            .add_torrent(
                add,
                Some(AddTorrentOptions {
                    list_only: true,
                    ..Default::default()
                }),
            )
            .await
            .map_err(|_| TorrentApiError::LibrqbitError)?;

        match response {
            AddTorrentResponse::ListOnly(resp) => {
                let torrent_bytes = resp.torrent_bytes.clone();
                tokio::spawn(async move {
                    if let Some(parent) = torrent_path.parent() {
                        _ = tokio::fs::create_dir_all(parent).await;
                    }
                    if let Ok(mut file) = tokio::fs::OpenOptions::new()
                        .share_mode(0) // exclusive open
                        .open(torrent_path)
                        .await
                    {
                        _ = file.write_all(&*torrent_bytes).await;
                    }
                });

                Ok(resp)
            }
            _ => Err(TorrentApiError::UnexpectedTorrentState),
        }
    }
}

pub async fn get_torrent_idx_from_url(url: &str) -> Result<TorrentIdOrHash, TorrentApiError> {
    let actual_torrent_magnet = match Magnet::parse(url) {
        Ok(magnet) => magnet,
        Err(e) => {
            error!("Error Parsing Magnet : {:#?}", e);
            return Err(TorrentApiError::LibrqbitError);
        }
    };

    let actual_torrent_id20 = Magnet::as_id20(&actual_torrent_magnet);
    Ok(TorrentIdOrHash::Hash(actual_torrent_id20.unwrap()))
}

pub fn convert_file_infos(
    raw_file_infos: &[librqbit::file_info::FileInfo],
) -> Vec<crate::model::FileInfo> {
    raw_file_infos
        .iter()
        .enumerate()
        .map(|(i, info)| crate::model::FileInfo {
            file_name: info.relative_filename.clone(),
            length: info.len,
            file_index: i,
        })
        .collect()
}

async fn get_add_torrent<'a>(
    magnet_str: &'a str,
) -> Result<(AddTorrent<'a>, PathBuf), TorrentApiError> {
    let app_id = "com.fitlauncher.carrotrub";
    let base_dir = BaseDirs::new().unwrap();

    let app_local_dir = base_dir.data_local_dir().join(app_id);
    let torrent_dir = app_local_dir.join("torrents");
    let app_data_dir = base_dir.data_dir().join(app_id);

    let magnet = Magnet::parse(&magnet_str).map_err(|_| TorrentApiError::InvalidMagnet)?;
    let magnet_hash = magnet
        .as_id20()
        .map(|id| id.as_string())
        .or_else(|| magnet.as_id32().map(|id| id.as_string()))
        .expect("magnet hash must exists");

    let torrent_path = torrent_dir.join(format!("{magnet_hash}.torrent"));

    // torrent with the same hash never expires
    if let Ok(torrent_from_file) = tokio::fs::read(&torrent_path).await {
        return Ok((AddTorrent::from_bytes(torrent_from_file), torrent_path));
    }

    let mut pastebin_link = None;

    let db_path = app_data_dir.join("sitemaps").join("search.db");
    if let Ok(conn) = db::open_connection_at(&db_path) {
        pastebin_link = db::get_pastebin_by_magnet_hash(&conn, magnet_hash)
            .ok()
            .and_then(|o| o);
    }

    match pastebin_link {
        Some(pastebin_link) => match decrypt_torrent_from_paste(pastebin_link.clone()).await {
            Ok(t) => {
                info!("downloaded torrent from {pastebin_link}");
                return Ok((AddTorrent::from_bytes(t), torrent_path));
            }
            Err(e) => {
                error!("failed to download metainfo from {pastebin_link}: {e}");
            }
        },
        None => (),
    };

    Ok((AddTorrent::from_url(magnet_str), torrent_path))
}
