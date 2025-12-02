//! Real-Debrid API Client
//!
//! API docs: https://api.real-debrid.com/
//! Cache check workaround: add torrent, check if "downloaded", delete if not cached.

use super::types::*;
use crate::debrid::types::{
    DebridCacheStatus, DebridDirectLink, DebridError, DebridFile, DebridTorrentInfo,
    DebridTorrentStatus,
};
use reqwest::Client;
use tracing::{debug, error, info, instrument, warn};

const BASE_URL: &str = "https://api.real-debrid.com/rest/1.0";

#[derive(Clone)]
pub struct RealDebridClient {
    api_key: String,
    client: Client,
}

impl RealDebridClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
        }
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.api_key)
    }

    fn handle_error_status(&self, status: u16, error_text: &str) -> DebridError {
        match status {
            401 => DebridError::InvalidApiKey,
            403 => DebridError::InvalidApiKey,
            429 => DebridError::RateLimited,
            _ => DebridError::ApiError(format!("Status {}: {}", status, error_text)),
        }
    }

    #[instrument(skip(self), fields(torrent_id = %torrent_id))]
    async fn get_raw_torrent_info(&self, torrent_id: &str) -> Result<TorrentInfo, DebridError> {
        let url = format!("{}/torrents/info/{}", BASE_URL, torrent_id);

        let response = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(self.handle_error_status(status.as_u16(), &error_text));
        }

        response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))
    }

    #[instrument(skip(self), fields(torrent_id = %torrent_id))]
    pub async fn get_torrent_status(
        &self,
        torrent_id: &str,
    ) -> Result<DebridTorrentStatus, DebridError> {
        let torrent = self.get_raw_torrent_info(torrent_id).await?;

        let is_ready = torrent.status == "downloaded";

        Ok(DebridTorrentStatus {
            id: torrent_id.to_string(),
            status: torrent.status,
            is_ready,
            progress: torrent.progress,
            speed: torrent.speed,
            seeders: torrent.seeders,
            name: torrent.filename,
            size: torrent.bytes,
        })
    }

    #[instrument(skip(self), fields(torrent_id = %torrent_id))]
    pub async fn delete_torrent(&self, torrent_id: &str) -> Result<(), DebridError> {
        let url = format!("{}/torrents/delete/{}", BASE_URL, torrent_id);

        debug!("Deleting torrent {}", torrent_id);

        let response = self
            .client
            .delete(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        // Real-Debrid returns 204 No Content on success
        if status.as_u16() == 204 || status.is_success() {
            debug!("Torrent deleted successfully");
            Ok(())
        } else {
            let error_text = response.text().await.unwrap_or_default();
            error!(
                "Delete torrent failed with status {}: {}",
                status, error_text
            );
            Err(self.handle_error_status(status.as_u16(), &error_text))
        }
    }

    #[instrument(skip(self))]
    pub async fn get_user_torrents(&self) -> Result<Vec<TorrentItem>, DebridError> {
        let url = format!("{}/torrents", BASE_URL);

        debug!("Getting user torrents");

        let response = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(self.handle_error_status(status.as_u16(), &error_text));
        }

        response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))
    }

    async fn find_existing_torrent(&self, hash: &str) -> Result<Option<String>, DebridError> {
        let torrents = self.get_user_torrents().await?;
        let target_hash = hash.to_lowercase();

        for torrent in torrents {
            if torrent.hash.to_lowercase() == target_hash {
                return Ok(Some(torrent.id));
            }
        }
        Ok(None)
    }

    /// Adds torrent and selects all files (required by Real-Debrid)
    #[instrument(skip(self, magnet))]
    pub async fn add_torrent(&self, magnet: &str) -> Result<String, DebridError> {
        let url = format!("{}/torrents/addMagnet", BASE_URL);

        info!("Adding torrent via magnet to Real-Debrid");
        debug!("Magnet link: {}", magnet);

        // Extract hash from magnet to check for duplicates
        if let Some(hash_start) = magnet.find("btih:") {
            let hash_end = magnet[hash_start + 5..]
                .find('&')
                .map(|i| hash_start + 5 + i)
                .unwrap_or(magnet.len());
            let hash = &magnet[hash_start + 5..hash_end];

            if let Ok(Some(existing_id)) = self.find_existing_torrent(hash).await {
                info!(
                    "Torrent already exists with id: {}, returning existing",
                    existing_id
                );
                return Ok(existing_id);
            }
        }

        let params = [("magnet", magnet)];

        let response = self
            .client
            .post(&url)
            .header("Authorization", self.auth_header())
            .form(&params)
            .send()
            .await
            .map_err(|e| {
                error!("Network error adding torrent: {}", e);
                DebridError::NetworkError(e.to_string())
            })?;

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();

        info!("Real-Debrid addMagnet response status: {}", status);
        debug!("Real-Debrid addMagnet response body: {}", response_text);

        if !status.is_success() {
            error!(
                "Add torrent failed with status {}: {}",
                status, response_text
            );
            return Err(self.handle_error_status(status.as_u16(), &response_text));
        }

        let resp: AddTorrentResponse = serde_json::from_str(&response_text).map_err(|e| {
            error!(
                "Failed to parse addMagnet response: {} - body was: {}",
                e, response_text
            );
            DebridError::ApiError(format!("Failed to parse response: {}", e))
        })?;

        // Parse ID - Real-Debrid returns string ID
        let torrent_id = resp.id;

        info!("Torrent added with id: {}", torrent_id);

        // Real-Debrid requires file selection - select all files
        self.select_all_files(&torrent_id).await?;

        Ok(torrent_id)
    }

    #[instrument(skip(self, file_bytes))]
    pub async fn add_torrent_file(&self, file_bytes: Vec<u8>) -> Result<String, DebridError> {
        let url = format!("{}/torrents/addTorrent", BASE_URL);

        info!("Adding torrent file to Real-Debrid");

        let response = self
            .client
            .put(&url)
            .header("Authorization", self.auth_header())
            .body(file_bytes)
            .send()
            .await
            .map_err(|e| {
                error!("Network error adding torrent file: {}", e);
                DebridError::NetworkError(e.to_string())
            })?;

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();

        info!("Real-Debrid addTorrent response status: {}", status);
        debug!("Real-Debrid addTorrent response body: {}", response_text);

        if !status.is_success() {
            error!(
                "Add torrent file failed with status {}: {}",
                status, response_text
            );
            return Err(self.handle_error_status(status.as_u16(), &response_text));
        }

        let resp: AddTorrentResponse = serde_json::from_str(&response_text).map_err(|e| {
            error!(
                "Failed to parse addTorrent response: {} - body was: {}",
                e, response_text
            );
            DebridError::ApiError(format!("Failed to parse response: {}", e))
        })?;

        // Parse ID
        let torrent_id = resp.id;

        info!("Torrent file added with id: {}", torrent_id);

        // Real-Debrid requires file selection - select all files
        self.select_all_files(&torrent_id).await?;

        Ok(torrent_id)
    }

    /// Workaround: adds torrent, checks if "downloaded", deletes if not cached
    #[instrument(skip(self), fields(hash = %hash))]
    pub async fn check_cache(&self, hash: &str) -> Result<DebridCacheStatus, DebridError> {
        let magnet = format!("magnet:?xt=urn:btih:{}", hash);
        let torrent_id = self.add_torrent(&magnet).await?;
        let status = self.get_torrent_status(&torrent_id).await?;
        let info = self.get_torrent_info(&torrent_id).await?;

        if status.status == "downloaded" {
            info!("Torrent {} is cached", torrent_id);
            Ok(DebridCacheStatus {
                is_cached: true,
                name: Some(status.name),
                size: Some(status.size),
                hash: info.hash,
            })
        } else {
            info!("Torrent {} is NOT cached, deleting", torrent_id);
            self.delete_torrent(&torrent_id).await?;
            Ok(DebridCacheStatus {
                is_cached: false,
                name: None,
                size: None,
                hash: info.hash,
            })
        }
    }

    #[instrument(skip(self), fields(torrent_id = %torrent_id))]
    async fn select_all_files(&self, torrent_id: &str) -> Result<(), DebridError> {
        let url = format!("{}/torrents/selectFiles/{}", BASE_URL, torrent_id);
        info!("Selecting all files for torrent {}", torrent_id);
        let params = [("files", "all")];

        let response = self
            .client
            .post(&url)
            .header("Authorization", self.auth_header())
            .form(&params)
            .send()
            .await
            .map_err(|e| {
                error!("Network error selecting files: {}", e);
                DebridError::NetworkError(e.to_string())
            })?;

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();

        info!("Real-Debrid selectFiles response status: {}", status);
        debug!("Real-Debrid selectFiles response body: {}", response_text);

        // Real-Debrid returns 204 No Content on success
        if status.as_u16() == 204 || status.is_success() {
            info!("Files selected successfully for torrent {}", torrent_id);
            Ok(())
        } else {
            error!(
                "Select files failed with status {}: {}",
                status, response_text
            );
            Err(self.handle_error_status(status.as_u16(), &response_text))
        }
    }

    #[instrument(skip(self), fields(torrent_id = %id))]
    pub async fn get_torrent_info(&self, id: &str) -> Result<DebridTorrentInfo, DebridError> {
        debug!("Getting torrent info for id: {}", id);
        let torrent = self.get_raw_torrent_info(id).await?;

        if torrent.status != "downloaded" {
            warn!(
                "Torrent status is '{}', expected 'downloaded'",
                torrent.status
            );
        }

        Ok(DebridTorrentInfo {
            id: id.to_string(),
            name: torrent.filename.clone(),
            size: torrent.bytes,
            hash: torrent.hash,
            files: torrent
                .files
                .into_iter()
                .filter(|f| f.selected == 1)
                .map(|f| {
                    let short_name = f.path.rsplit('/').next().unwrap_or(&f.path).to_string();

                    DebridFile {
                        id: f.id.to_string(),
                        name: f.path.clone(),
                        short_name,
                        size: f.bytes,
                    }
                })
                .collect(),
        })
    }

    /// RD may return fewer links than files (archives/splits) - matches by file index
    #[instrument(skip(self), fields(torrent_id = %torrent_id, file_id = %file_id))]
    pub async fn get_download_link(
        &self,
        torrent_id: &str,
        file_id: &str,
        filename: &str,
        size: u64,
    ) -> Result<DebridDirectLink, DebridError> {
        let url = format!("{}/torrents/info/{}", BASE_URL, torrent_id);

        debug!("Getting torrent info for download link");

        let response = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(self.handle_error_status(status.as_u16(), &error_text));
        }

        let torrent: TorrentInfo = response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))?;

        debug!(
            "Torrent info: status={}, files={}, links={}",
            torrent.status,
            torrent.files.len(),
            torrent.links.len()
        );

        if torrent.status != "downloaded" {
            warn!(
                "Torrent status is '{}', not 'downloaded' - links may not be ready",
                torrent.status
            );
            return Err(DebridError::ApiError(format!(
                "Torrent not ready, status: {}",
                torrent.status
            )));
        }

        let selected_files: Vec<_> = torrent.files.iter().filter(|f| f.selected == 1).collect();

        debug!(
            "Selected files: {}, Available links: {}",
            selected_files.len(),
            torrent.links.len()
        );

        // Single link for multiple files = likely combined into archive
        if torrent.links.len() == 1 && selected_files.len() > 1 {
            info!(
                "Single link for {} files - files are likely combined into an archive",
                selected_files.len()
            );
            let link = &torrent.links[0];
            return self.unrestrict_link(link, filename, size).await;
        }

        let file_id_num: u64 = file_id
            .parse()
            .map_err(|_| DebridError::ApiError(format!("Invalid file ID: {}", file_id)))?;

        let link_index = selected_files
            .iter()
            .position(|f| f.id == file_id_num)
            .ok_or_else(|| {
                error!(
                    "File ID {} not found in selected files: {:?}",
                    file_id,
                    selected_files.iter().map(|f| f.id).collect::<Vec<_>>()
                );
                DebridError::ApiError("File not found in torrent".to_string())
            })?;

        debug!("Found file at index {} in selected files", link_index);
        debug!("Total links available: {}", torrent.links.len());

        let link = if link_index < torrent.links.len() {
            &torrent.links[link_index]
        } else if !torrent.links.is_empty() {
            warn!(
                "Link index {} exceeds available links ({}). Files may be archived together.",
                link_index,
                torrent.links.len()
            );
            return Err(DebridError::ApiError(format!(
                "File '{}' may be part of an archive. Only {} link(s) available for {} selected files. \
                 Download the archive and extract the file.",
                filename,
                torrent.links.len(),
                selected_files.len()
            )));
        } else {
            error!("No links available for torrent {}", torrent_id);
            return Err(DebridError::ApiError(
                "No links available for torrent".to_string(),
            ));
        };

        debug!("Found link to unrestrict: {}", link);
        self.unrestrict_link(link, filename, size).await
    }

    #[instrument(skip(self), fields(torrent_id = %torrent_id))]
    pub async fn get_all_download_links(
        &self,
        torrent_id: &str,
    ) -> Result<Vec<DebridDirectLink>, DebridError> {
        let url = format!("{}/torrents/info/{}", BASE_URL, torrent_id);

        debug!("Getting all download links for torrent {}", torrent_id);

        let response = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(self.handle_error_status(status.as_u16(), &error_text));
        }

        let torrent: TorrentInfo = response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))?;

        if torrent.status != "downloaded" {
            return Err(DebridError::ApiError(format!(
                "Torrent not ready, status: {}",
                torrent.status
            )));
        }

        if torrent.links.is_empty() {
            return Err(DebridError::ApiError(
                "No links available for torrent".to_string(),
            ));
        }

        info!(
            "Unrestricting {} links for torrent {}",
            torrent.links.len(),
            torrent_id
        );

        let mut download_links = Vec::with_capacity(torrent.links.len());
        for link in &torrent.links {
            let direct_link = self.unrestrict_link(link, "", 0).await?;
            download_links.push(direct_link);
        }

        Ok(download_links)
    }

    #[instrument(skip(self, link))]
    async fn unrestrict_link(
        &self,
        link: &str,
        filename: &str,
        size: u64,
    ) -> Result<DebridDirectLink, DebridError> {
        let url = format!("{}/unrestrict/link", BASE_URL);

        debug!("Unrestricting link");

        let params = [("link", link)];

        let response = self
            .client
            .post(&url)
            .header("Authorization", self.auth_header())
            .form(&params)
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(self.handle_error_status(status.as_u16(), &error_text));
        }

        let resp: UnrestrictResponse = response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))?;

        debug!("Got download URL for {}", resp.filename);

        Ok(DebridDirectLink {
            url: resp.download,
            filename: resp.filename,
            size: resp.filesize,
        })
    }
}
