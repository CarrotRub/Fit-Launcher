use crate::client::RealDebridClient;
use crate::errors::RealDebridApiError;
use crate::structs::{TorrentFilesResponse, TorrentInfo, UnrestrictLinkResponse};
use fit_launcher_ddl::DirectLink;
use tracing::error;

#[tauri::command]
#[specta]
pub async fn add_realdebrid_magnet(
    magnet: String,
    token: String,
) -> Result<String, RealDebridApiError> {
    let client = RealDebridClient::new(token);
    let response = client.add_magnet(&magnet).await?;
    Ok(response.id)
}

#[tauri::command]
#[specta]
pub async fn get_realdebrid_torrent_info(
    id: String,
    token: String,
) -> Result<TorrentInfo, RealDebridApiError> {
    let client = RealDebridClient::new(token);
    client.get_torrent_info(&id).await
}

#[tauri::command]
#[specta]
pub async fn get_realdebrid_torrent_files(
    id: String,
    token: String,
) -> Result<TorrentFilesResponse, RealDebridApiError> {
    let client = RealDebridClient::new(token);
    client.get_torrent_files(&id).await
}

#[tauri::command]
#[specta]
pub async fn select_realdebrid_files(
    id: String,
    file_ids: Vec<u32>,
    token: String,
) -> Result<(), RealDebridApiError> {
    let client = RealDebridClient::new(token);
    client.select_files(&id, &file_ids).await
}

#[tauri::command]
#[specta]
pub async fn get_realdebrid_download_links(
    id: String,
    token: String,
) -> Result<Vec<DirectLink>, RealDebridApiError> {
    let client = RealDebridClient::new(token);
    
    // First get torrent info to get the links
    let torrent_info = client.get_torrent_files(&id).await?;
    
    if torrent_info.links.is_empty() {
        return Err(RealDebridApiError::ApiError(
            "No download links available".to_string(),
        ));
    }

    // Convert each Real-Debrid link to unrestricted download link
    let mut direct_links = Vec::new();
    
    for link in torrent_info.links {
        match client.get_download_links(&link).await {
            Ok(unrestricted) => {
                // Extract filename from the unrestricted response
                let filename = if !unrestricted.filename.is_empty() {
                    unrestricted.filename.clone()
                } else {
                    // Fallback: extract from URL or use default
                    link.split('/').last().unwrap_or("file.bin").to_string()
                };
                
                direct_links.push(DirectLink {
                    url: unrestricted.link,
                    filename,
                });
            }
            Err(e) => {
                error!("Failed to unrestrict link {}: {}", link, e);
                // Continue with other links instead of failing completely
            }
        }
    }

    if direct_links.is_empty() {
        return Err(RealDebridApiError::ApiError(
            "Failed to get any download links".to_string(),
        ));
    }

    Ok(direct_links)
}

#[tauri::command]
#[specta]
pub async fn wait_realdebrid_torrent_ready(
    id: String,
    token: String,
    max_wait_seconds: Option<u64>,
) -> Result<TorrentFilesResponse, RealDebridApiError> {
    let client = RealDebridClient::new(token);
    let max_wait = max_wait_seconds.unwrap_or(1800); // Default 30 minutes
    client.wait_for_torrent_ready(&id, max_wait).await
}
