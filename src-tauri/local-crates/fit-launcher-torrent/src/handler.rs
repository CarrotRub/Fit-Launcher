use std::sync::Arc;

use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, ListOnlyResponse, Magnet, Session,
    api::TorrentIdOrHash,
};
use tracing::error;

use crate::errors::TorrentApiError;

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
        let session = &self.session;

        let magnet = Magnet::parse(&magnet_str).map_err(|_| TorrentApiError::InvalidMagnet)?;

        let response = session
            .add_torrent(
                AddTorrent::from_url(magnet.to_string()),
                Some(AddTorrentOptions {
                    list_only: true,
                    ..Default::default()
                }),
            )
            .await
            .map_err(|_| TorrentApiError::LibrqbitError)?;

        match response {
            AddTorrentResponse::ListOnly(resp) => Ok(resp),
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
