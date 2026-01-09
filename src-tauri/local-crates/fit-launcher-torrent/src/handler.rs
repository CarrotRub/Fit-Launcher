use std::{path::PathBuf, sync::Arc};

use directories::BaseDirs;
use fit_launcher_scraping::db;
use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, ListOnlyResponse, Magnet, Session,
    SessionOptions, api::TorrentIdOrHash,
};
use librqbit_dht::PersistentDhtConfig;
use parking_lot::Mutex;
use tokio::io::AsyncWriteExt;
use tracing::{error, info, warn};

use crate::{decrypt_torrent_from_paste, dht::dht_config_with_udp, errors::TorrentApiError};

pub struct LibrqbitSession {
    session: Arc<Mutex<Option<Arc<Session>>>>,
}

impl Clone for LibrqbitSession {
    fn clone(&self) -> Self {
        Self {
            session: Arc::clone(&self.session),
        }
    }
}

impl LibrqbitSession {
    pub async fn new() -> Self {
        let dht_runtime = dht_config_with_udp().expect("Error getting dht path");

        let ses_opts = SessionOptions {
            dht_config: Some(PersistentDhtConfig {
                config_filename: Some(dht_runtime.config_path.clone()),
                ..Default::default()
            }),
            ..Default::default()
        };

        let session = Session::new_with_opts("/temp/".into(), ses_opts)
            .await
            .expect("Failed to start Session");

        Self {
            session: Arc::new(Mutex::new(Some(session))),
        }
    }

    /// Shuts down the session by dropping it. Drop = port release.
    /// Idempotent - safe to call multiple times.
    pub fn shutdown(&self) {
        if self.session.lock().take().is_some() {
            info!("LibrqbitSession shut down");
        }
    }

    /// Returns true if the session is still active (not shut down).
    pub fn is_active(&self) -> bool {
        self.session.lock().is_some()
    }

    pub async fn get_metadata_only(
        &self,
        magnet_str: String,
    ) -> Result<ListOnlyResponse, TorrentApiError> {
        let (add, torrent_path) = get_add_torrent(&magnet_str).await?;

        // Clone Arc briefly, release lock immediately - don't hold across await
        let session = self
            .session
            .lock()
            .as_ref()
            .cloned()
            .ok_or(TorrentApiError::LibrqbitError)?;

        let response = session
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
                    let mut options = tokio::fs::OpenOptions::new();
                    let options = options.create(true).write(true).truncate(true);
                    #[cfg(windows)]
                    {
                        options = options.share_mode(0);
                    }
                    let file = options.open(torrent_path).await;

                    if let Ok(mut file) = file {
                        _ = file.write_all(&torrent_bytes).await;
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

    let magnet = Magnet::parse(magnet_str).map_err(|_| TorrentApiError::InvalidMagnet)?;
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

    if let Some(pastebin_link) = pastebin_link {
        match decrypt_torrent_from_paste(pastebin_link.clone()).await {
            Ok(t) => {
                if librqbit::torrent_from_bytes::<'_, librqbit_buffers::ByteBuf>(&t).is_ok() {
                    info!("downloaded torrent from {pastebin_link}");
                    return Ok((AddTorrent::from_bytes(t), torrent_path));
                } else {
                    warn!("metadata downloaded from {pastebin_link} was corrupted!");
                }
            }
            Err(e) => {
                error!("failed to download metainfo from {pastebin_link}: {e}");
            }
        }
    }

    Ok((AddTorrent::from_url(magnet_str), torrent_path))
}
