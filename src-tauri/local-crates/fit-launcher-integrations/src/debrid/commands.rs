//! Tauri commands for debrid services. API keys from credential store.

use crate::credentials;
use crate::debrid::{
    DebridCacheStatus, DebridDirectLink, DebridError, DebridFile, DebridProvider,
    DebridProviderInfo, DebridTorrentInfo, DebridTorrentStatus, RealDebridClient, TorBoxClient,
};
use specta::specta;
use tracing::info;

fn get_api_key(provider: DebridProvider) -> Result<String, DebridError> {
    credentials::get(provider).map_err(|_| DebridError::NotConfigured)
}

#[tauri::command]
#[specta]
pub fn debrid_list_providers() -> Vec<DebridProviderInfo> {
    DebridProvider::all()
        .into_iter()
        .map(|p| p.info())
        .collect()
}

#[tauri::command]
#[specta]
pub async fn debrid_check_cache(
    provider: DebridProvider,
    hash: String,
) -> Result<DebridCacheStatus, DebridError> {
    info!("Received debrid_check_cache request for hash: {}", hash);
    let api_key = get_api_key(provider)?;

    match provider {
        DebridProvider::TorBox => {
            let client = TorBoxClient::new(api_key);
            client.check_cache(&hash).await
        }
        DebridProvider::RealDebrid => {
            let client = RealDebridClient::new(api_key);
            client.check_cache(&hash).await
        }
        _ => Err(DebridError::NotConfigured),
    }
}

#[tauri::command]
#[specta]
pub async fn debrid_add_torrent(
    provider: DebridProvider,
    magnet: String,
) -> Result<String, DebridError> {
    let api_key = get_api_key(provider)?;

    match provider {
        DebridProvider::TorBox => {
            let client = TorBoxClient::new(api_key);
            client.add_torrent(&magnet).await
        }
        DebridProvider::RealDebrid => {
            let client = RealDebridClient::new(api_key);
            client.add_torrent(&magnet).await
        }
        _ => Err(DebridError::NotConfigured),
    }
}

#[tauri::command]
#[specta]
pub async fn debrid_get_torrent_info(
    provider: DebridProvider,
    torrent_id: String,
) -> Result<DebridTorrentInfo, DebridError> {
    let api_key = get_api_key(provider)?;

    match provider {
        DebridProvider::TorBox => {
            let client = TorBoxClient::new(api_key);
            let id = torrent_id
                .parse::<u64>()
                .map_err(|_| DebridError::ApiError(format!("Invalid TorBox ID: {}", torrent_id)))?;
            client.get_torrent_info(id).await
        }
        DebridProvider::RealDebrid => {
            let client = RealDebridClient::new(api_key);
            client.get_torrent_info(&torrent_id).await
        }
        _ => Err(DebridError::NotConfigured),
    }
}

#[tauri::command]
#[specta]
pub async fn debrid_get_download_link(
    provider: DebridProvider,
    torrent_id: String,
    file: DebridFile,
) -> Result<DebridDirectLink, DebridError> {
    let api_key = get_api_key(provider)?;

    match provider {
        DebridProvider::TorBox => {
            let client = TorBoxClient::new(api_key);
            let t_id = torrent_id.parse::<u64>().map_err(|_| {
                DebridError::ApiError(format!("Invalid TorBox Torrent ID: {}", torrent_id))
            })?;
            let f_id = file.id.parse::<u64>().map_err(|_| {
                DebridError::ApiError(format!("Invalid TorBox File ID: {}", file.id))
            })?;
            client
                .get_download_link(t_id, f_id, &file.short_name, file.size)
                .await
        }
        DebridProvider::RealDebrid => {
            let client = RealDebridClient::new(api_key);
            client
                .get_download_link(&torrent_id, &file.id, &file.short_name, file.size)
                .await
        }
        _ => Err(DebridError::NotConfigured),
    }
}

/// RD may return fewer links than files (archives)
#[tauri::command]
#[specta]
pub async fn debrid_get_download_links(
    provider: DebridProvider,
    torrent_id: String,
    files: Vec<DebridFile>,
) -> Result<Vec<DebridDirectLink>, DebridError> {
    let api_key = get_api_key(provider)?;

    match provider {
        DebridProvider::TorBox => {
            let client = TorBoxClient::new(api_key);
            let mut links = Vec::with_capacity(files.len());
            let t_id = torrent_id.parse::<u64>().map_err(|_| {
                DebridError::ApiError(format!("Invalid TorBox Torrent ID: {}", torrent_id))
            })?;

            for file in files {
                let f_id = file.id.parse::<u64>().map_err(|_| {
                    DebridError::ApiError(format!("Invalid TorBox File ID: {}", file.id))
                })?;
                let link = client
                    .get_download_link(t_id, f_id, &file.short_name, file.size)
                    .await?;
                links.push(link);
            }

            Ok(links)
        }
        DebridProvider::RealDebrid => {
            let client = RealDebridClient::new(api_key);
            client.get_all_download_links(&torrent_id).await
        }
        _ => Err(DebridError::NotConfigured),
    }
}

#[tauri::command]
#[specta]
pub async fn debrid_get_torrent_status(
    provider: DebridProvider,
    torrent_id: String,
) -> Result<DebridTorrentStatus, DebridError> {
    let api_key = get_api_key(provider)?;

    match provider {
        DebridProvider::TorBox => Err(DebridError::ApiError(
            "Status polling not needed for TorBox".to_string(),
        )),
        DebridProvider::RealDebrid => {
            let client = RealDebridClient::new(api_key);
            client.get_torrent_status(&torrent_id).await
        }
        _ => Err(DebridError::NotConfigured),
    }
}

#[tauri::command]
#[specta]
pub async fn debrid_delete_torrent(
    provider: DebridProvider,
    torrent_id: String,
) -> Result<(), DebridError> {
    let api_key = get_api_key(provider)?;

    match provider {
        DebridProvider::TorBox => Err(DebridError::ApiError(
            "Delete not implemented for TorBox".to_string(),
        )),
        DebridProvider::RealDebrid => {
            let client = RealDebridClient::new(api_key);
            client.delete_torrent(&torrent_id).await
        }
        _ => Err(DebridError::NotConfigured),
    }
}
