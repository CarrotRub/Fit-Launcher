//! TorBox API client. Returns unified DebridTypes.

use super::types::*;
use crate::debrid::types::{
    DebridCacheStatus, DebridDirectLink, DebridError, DebridFile, DebridTorrentInfo,
};
use reqwest::Client;
use tracing::{debug, error, instrument};

const BASE_URL: &str = "https://api.torbox.app/v1/api";

#[derive(Clone)]
pub struct TorBoxClient {
    api_key: String,
    client: Client,
}

impl TorBoxClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
        }
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.api_key)
    }

    #[instrument(skip(self), fields(hash = %hash))]
    pub async fn check_cache(&self, hash: &str) -> Result<DebridCacheStatus, DebridError> {
        let url = format!(
            "{}/torrents/checkcached?hash={}&format=list&list_files=true",
            BASE_URL, hash
        );

        debug!("Checking cache for hash: {}", hash);

        let response = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(DebridError::InvalidApiKey);
        }
        if status.as_u16() == 429 {
            return Err(DebridError::RateLimited);
        }
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("Cache check failed with status {}: {}", status, error_text);
            return Err(DebridError::ApiError(format!(
                "Status {}: {}",
                status, error_text
            )));
        }

        let resp: TorBoxResponse<Vec<CachedTorrent>> = response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))?;

        if !resp.success {
            return Err(DebridError::ApiError(resp.detail));
        }

        // Convert to unified type
        if let Some(cached) = resp.data.first() {
            Ok(DebridCacheStatus {
                is_cached: true,
                name: Some(cached.name.clone()),
                size: Some(cached.size),
                hash: cached.hash.clone(),
            })
        } else {
            Ok(DebridCacheStatus {
                is_cached: false,
                name: None,
                size: None,
                hash: hash.to_string(),
            })
        }
    }

    #[instrument(skip(self, magnet))]
    pub async fn add_torrent(&self, magnet: &str) -> Result<String, DebridError> {
        let url = format!("{}/torrents/createtorrent", BASE_URL);

        let params = [
            ("magnet", magnet),
            ("seed", "3"), // Don't seed
            ("add_only_if_cached", "true"),
        ];

        debug!("Adding torrent (cached only)");

        let response = self
            .client
            .post(&url)
            .header("Authorization", self.auth_header())
            .form(&params)
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(DebridError::InvalidApiKey);
        }
        if status.as_u16() == 429 {
            return Err(DebridError::RateLimited);
        }
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("Add torrent failed with status {}: {}", status, error_text);
            return Err(DebridError::ApiError(format!(
                "Status {}: {}",
                status, error_text
            )));
        }

        let resp: TorBoxResponse<CreateTorrentData> = response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))?;

        if resp.success {
            debug!("Torrent added with id: {}", resp.data.torrent_id);
            Ok(resp.data.torrent_id.to_string())
        } else {
            Err(DebridError::ApiError(resp.detail))
        }
    }

    #[instrument(skip(self), fields(torrent_id = %id))]
    pub async fn get_torrent_info(&self, id: u64) -> Result<DebridTorrentInfo, DebridError> {
        let url = format!("{}/torrents/mylist?id={}&bypass_cache=true", BASE_URL, id);

        debug!("Getting torrent info for id: {}", id);

        let response = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(DebridError::InvalidApiKey);
        }
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(DebridError::ApiError(format!(
                "Status {}: {}",
                status, error_text
            )));
        }

        let resp: TorBoxResponse<TorBoxTorrent> = response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))?;

        if !resp.success {
            return Err(DebridError::ApiError(resp.detail));
        }

        // Convert to unified type
        let torrent = resp.data;
        Ok(DebridTorrentInfo {
            id: torrent.id.to_string(),
            name: torrent.name,
            size: torrent.size,
            hash: torrent.hash,
            files: torrent
                .files
                .into_iter()
                .map(|f| DebridFile {
                    id: f.id.to_string(),
                    name: f.name,
                    short_name: f.short_name,
                    size: f.size,
                })
                .collect(),
        })
    }

    #[instrument(skip(self), fields(torrent_id = %torrent_id, file_id = %file_id))]
    pub async fn get_download_link(
        &self,
        torrent_id: u64,
        file_id: u64,
        filename: &str,
        size: u64,
    ) -> Result<DebridDirectLink, DebridError> {
        // Token is passed as query param for this endpoint
        let url = format!(
            "{}/torrents/requestdl?token={}&torrent_id={}&file_id={}",
            BASE_URL, self.api_key, torrent_id, file_id
        );

        debug!("Requesting download link for file {}", file_id);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DebridError::NetworkError(e.to_string()))?;

        let status = response.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(DebridError::InvalidApiKey);
        }
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(DebridError::ApiError(format!(
                "Status {}: {}",
                status, error_text
            )));
        }

        let resp: TorBoxResponse<String> = response
            .json()
            .await
            .map_err(|e| DebridError::ApiError(e.to_string()))?;

        if resp.success {
            Ok(DebridDirectLink {
                url: resp.data,
                filename: filename.to_string(),
                size,
            })
        } else {
            Err(DebridError::ApiError(resp.detail))
        }
    }
}
