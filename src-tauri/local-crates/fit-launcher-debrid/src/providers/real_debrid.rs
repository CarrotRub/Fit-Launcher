use async_trait::async_trait;
use chrono::{DateTime, Utc};
use fit_launcher_ddl::DirectLink;
use reqwest::Client;
use serde::Deserialize;
use tracing::{debug, error, warn};

use crate::{
    DebridError, DebridFile, DebridProvider, DebridTorrentInfo, SubscriptionInfo, TorrentStatus,
    TorrentStatusKind,
};

const BASE_URL: &str = "https://api.real-debrid.com/rest/1.0";

/// Real-Debrid API provider implementation
pub struct RealDebridProvider {
    client: Client,
}

impl RealDebridProvider {
    /// Create a new Real-Debrid provider instance
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Create a new provider with a custom HTTP client
    pub fn with_client(client: Client) -> Self {
        Self { client }
    }

    /// Make an authenticated GET request
    async fn get<T: for<'de> Deserialize<'de>>(
        &self,
        api_key: &str,
        endpoint: &str,
    ) -> Result<T, DebridError> {
        let url = format!("{}{}", BASE_URL, endpoint);
        debug!("Real-Debrid GET: {}", url);

        let response = self
            .client
            .get(&url)
            .bearer_auth(api_key)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Make an authenticated POST request with form data
    async fn post<T: for<'de> Deserialize<'de>>(
        &self,
        api_key: &str,
        endpoint: &str,
        form: &[(&str, &str)],
    ) -> Result<T, DebridError> {
        let url = format!("{}{}", BASE_URL, endpoint);
        debug!("Real-Debrid POST: {} with {:?}", url, form);

        let response = self
            .client
            .post(&url)
            .bearer_auth(api_key)
            .form(form)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Make an authenticated DELETE request
    async fn delete(&self, api_key: &str, endpoint: &str) -> Result<(), DebridError> {
        let url = format!("{}{}", BASE_URL, endpoint);
        debug!("Real-Debrid DELETE: {}", url);

        let response = self
            .client
            .delete(&url)
            .bearer_auth(api_key)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("Real-Debrid DELETE error: {} - {}", status, text);
            Err(self.parse_error(status.as_u16(), &text))
        }
    }

    /// Handle API response and parse errors
    async fn handle_response<T: for<'de> Deserialize<'de>>(
        &self,
        response: reqwest::Response,
    ) -> Result<T, DebridError> {
        let status = response.status();

        if status.is_success() {
            let text = response.text().await?;
            debug!("Real-Debrid response: {}", text);
            serde_json::from_str(&text).map_err(|e| {
                error!("Failed to parse Real-Debrid response: {} - {}", e, text);
                DebridError::InternalError(format!("JSON parse error: {}", e))
            })
        } else {
            let text = response.text().await.unwrap_or_default();
            error!("Real-Debrid API error: {} - {}", status, text);
            Err(self.parse_error(status.as_u16(), &text))
        }
    }

    /// Parse error response from Real-Debrid
    fn parse_error(&self, status: u16, body: &str) -> DebridError {
        // Try to parse as JSON error
        if let Ok(err) = serde_json::from_str::<RdErrorResponse>(body) {
            return match err.error_code {
                1 => DebridError::InternalError("Missing parameter".to_string()),
                2 => DebridError::InvalidApiKey,
                3 => DebridError::InvalidApiKey, // Unknown token
                4 => DebridError::InvalidApiKey, // Token expired
                5 => DebridError::SubscriptionExpired,
                8 => DebridError::MagnetNotSupported,
                9 => DebridError::InternalError("Permission denied".to_string()),
                10 => DebridError::TorrentNotFound,
                11 => DebridError::QuotaExceeded,
                12 => DebridError::RateLimited(60),
                20 => DebridError::MagnetNotSupported, // Unsupported hoster
                21 => DebridError::MagnetNotSupported, // Hoster in maintenance
                22 => DebridError::MagnetNotSupported, // Hoster limit reached
                23 => DebridError::QuotaExceeded, // Hoster not available for free
                24 => DebridError::QuotaExceeded, // Too many downloads
                25 => DebridError::MagnetNotSupported, // IP not allowed
                _ => DebridError::ApiError {
                    code: err.error_code,
                    message: err.error,
                },
            };
        }

        // Fallback based on HTTP status
        match status {
            401 => DebridError::InvalidApiKey,
            403 => DebridError::SubscriptionExpired,
            404 => DebridError::TorrentNotFound,
            429 => DebridError::RateLimited(60),
            _ => DebridError::ApiError {
                code: status as i32,
                message: body.to_string(),
            },
        }
    }

    /// Convert Real-Debrid torrent status to our status enum
    fn convert_status(status: &str) -> TorrentStatusKind {
        match status {
            "magnet_error" | "error" | "virus" | "dead" => TorrentStatusKind::Error,
            "magnet_conversion" | "waiting_files_selection" => TorrentStatusKind::Queued,
            "queued" | "downloading" => TorrentStatusKind::Downloading,
            "uploading" | "compressing" => TorrentStatusKind::Processing,
            "downloaded" => TorrentStatusKind::Ready,
            _ => TorrentStatusKind::Queued,
        }
    }
}

impl Default for RealDebridProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DebridProvider for RealDebridProvider {
    fn id(&self) -> &'static str {
        "real_debrid"
    }

    fn name(&self) -> &'static str {
        "Real-Debrid"
    }

    fn website_url(&self) -> &'static str {
        "https://real-debrid.com"
    }

    async fn validate_api_key(&self, api_key: &str) -> Result<bool, DebridError> {
        match self.get::<RdUserResponse>(api_key, "/user").await {
            Ok(_) => Ok(true),
            Err(DebridError::InvalidApiKey) => Ok(false),
            Err(e) => Err(e),
        }
    }

    async fn get_subscription_info(&self, api_key: &str) -> Result<SubscriptionInfo, DebridError> {
        let user: RdUserResponse = self.get(api_key, "/user").await?;

        let expires_at = user.expiration.and_then(|exp| {
            DateTime::parse_from_rfc3339(&exp)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });

        Ok(SubscriptionInfo {
            is_premium: user.premium > 0,
            expires_at,
            points: Some(user.points),
            username: Some(user.username),
        })
    }

    async fn add_magnet(&self, api_key: &str, magnet: &str) -> Result<String, DebridError> {
        let response: RdAddMagnetResponse = self
            .post(api_key, "/torrents/addMagnet", &[("magnet", magnet)])
            .await?;

        debug!("Real-Debrid added magnet with ID: {}", response.id);
        Ok(response.id)
    }

    async fn get_torrent_status(
        &self,
        api_key: &str,
        remote_id: &str,
    ) -> Result<TorrentStatus, DebridError> {
        let info: RdTorrentInfoResponse = self
            .get(api_key, &format!("/torrents/info/{}", remote_id))
            .await?;

        let status_kind = Self::convert_status(&info.status);
        let progress = info.progress as f64;

        Ok(TorrentStatus {
            id: info.id,
            status: status_kind,
            progress,
            speed: info.speed.map(|s| s as u64),
            size: Some(info.bytes as u64),
            files_count: Some(info.files.len()),
            error_message: if info.status == "error" || info.status == "magnet_error" {
                Some("Torrent error".to_string())
            } else {
                None
            },
        })
    }

    async fn get_torrent_info(
        &self,
        api_key: &str,
        remote_id: &str,
    ) -> Result<DebridTorrentInfo, DebridError> {
        let info: RdTorrentInfoResponse = self
            .get(api_key, &format!("/torrents/info/{}", remote_id))
            .await?;

        let status = TorrentStatus {
            id: info.id.clone(),
            status: Self::convert_status(&info.status),
            progress: info.progress as f64,
            speed: info.speed.map(|s| s as u64),
            size: Some(info.bytes as u64),
            files_count: Some(info.files.len()),
            error_message: None,
        };

        let files = info
            .files
            .iter()
            .map(|f| DebridFile {
                index: f.id as usize,
                name: f.path.clone(),
                size: f.bytes as u64,
                selected: f.selected == 1,
                link: None,
            })
            .collect();

        let added_at = info.added.and_then(|a| {
            DateTime::parse_from_rfc3339(&a)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });

        Ok(DebridTorrentInfo {
            id: info.id,
            magnet: info.original_filename.unwrap_or_default(),
            name: info.filename,
            status,
            files,
            added_at,
        })
    }

    async fn select_files(
        &self,
        api_key: &str,
        remote_id: &str,
        file_indices: &[usize],
    ) -> Result<(), DebridError> {
        let files_param = if file_indices.is_empty() {
            "all".to_string()
        } else {
            file_indices
                .iter()
                .map(|i| i.to_string())
                .collect::<Vec<_>>()
                .join(",")
        };

        // This endpoint returns empty on success
        let _: serde_json::Value = self
            .post(
                api_key,
                &format!("/torrents/selectFiles/{}", remote_id),
                &[("files", &files_param)],
            )
            .await
            .or_else(|e| {
                // Some versions return empty response which fails JSON parsing
                if matches!(e, DebridError::InternalError(_)) {
                    Ok(serde_json::Value::Null)
                } else {
                    Err(e)
                }
            })?;

        debug!("Real-Debrid selected files: {}", files_param);
        Ok(())
    }

    async fn get_download_links(
        &self,
        api_key: &str,
        remote_id: &str,
    ) -> Result<Vec<DirectLink>, DebridError> {
        let info: RdTorrentInfoResponse = self
            .get(api_key, &format!("/torrents/info/{}", remote_id))
            .await?;

        // Check if torrent is ready
        if info.status != "downloaded" {
            return Err(DebridError::ConversionFailed(format!(
                "Torrent not ready, status: {}",
                info.status
            )));
        }

        // Get the links from the torrent info
        let links = info.links;
        if links.is_empty() {
            return Err(DebridError::ConversionFailed(
                "No download links available".to_string(),
            ));
        }

        // Unrestrict each link to get direct download URLs
        let mut direct_links = Vec::with_capacity(links.len());
        for link in links {
            match self.unrestrict_link(api_key, &link).await {
                Ok(dl) => direct_links.push(dl),
                Err(e) => {
                    warn!("Failed to unrestrict link {}: {:?}", link, e);
                    // Continue with other links
                }
            }
        }

        if direct_links.is_empty() {
            return Err(DebridError::ConversionFailed(
                "Failed to unrestrict any links".to_string(),
            ));
        }

        Ok(direct_links)
    }

    async fn delete_torrent(&self, api_key: &str, remote_id: &str) -> Result<(), DebridError> {
        self.delete(api_key, &format!("/torrents/delete/{}", remote_id))
            .await
    }

    async fn is_cached(&self, api_key: &str, magnet: &str) -> Result<bool, DebridError> {
        // Extract hash from magnet link
        let hash = extract_hash_from_magnet(magnet);
        if hash.is_none() {
            return Ok(false);
        }
        let hash = hash.unwrap();

        // Check instant availability
        let url = format!("/torrents/instantAvailability/{}", hash);
        let response: serde_json::Value = self.get(api_key, &url).await?;

        // If the hash exists and has data, it's cached
        if let Some(obj) = response.as_object() {
            if let Some(hash_data) = obj.get(&hash.to_lowercase()) {
                if let Some(arr) = hash_data.as_array() {
                    return Ok(!arr.is_empty());
                }
                if let Some(obj) = hash_data.as_object() {
                    return Ok(!obj.is_empty());
                }
            }
        }

        Ok(false)
    }
}

impl RealDebridProvider {
    /// Unrestrict a single link
    async fn unrestrict_link(&self, api_key: &str, link: &str) -> Result<DirectLink, DebridError> {
        let response: RdUnrestrictResponse = self
            .post(api_key, "/unrestrict/link", &[("link", link)])
            .await?;

        Ok(DirectLink {
            url: response.download,
            filename: response.filename,
            size: response.filesize as u64,
        })
    }
}

// ============================================================================
// Real-Debrid API Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
struct RdErrorResponse {
    error: String,
    error_code: i32,
}

#[derive(Debug, Deserialize)]
struct RdUserResponse {
    username: String,
    premium: i32,
    points: i64,
    expiration: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RdAddMagnetResponse {
    id: String,
    #[allow(dead_code)]
    uri: String,
}

#[derive(Debug, Deserialize)]
struct RdTorrentInfoResponse {
    id: String,
    filename: String,
    original_filename: Option<String>,
    #[allow(dead_code)]
    hash: String,
    bytes: i64,
    progress: f32,
    status: String,
    speed: Option<i64>,
    files: Vec<RdTorrentFile>,
    links: Vec<String>,
    added: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RdTorrentFile {
    id: i32,
    path: String,
    bytes: i64,
    selected: i32,
}

#[derive(Debug, Deserialize)]
struct RdUnrestrictResponse {
    #[allow(dead_code)]
    id: String,
    filename: String,
    filesize: i64,
    download: String,
    #[allow(dead_code)]
    #[serde(rename = "type")]
    mime_type: Option<String>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Extract the info hash from a magnet link
fn extract_hash_from_magnet(magnet: &str) -> Option<String> {
    // Look for xt=urn:btih: parameter
    if let Some(start) = magnet.find("xt=urn:btih:") {
        let hash_start = start + 12;
        let remaining = &magnet[hash_start..];

        // Hash ends at next & or end of string
        let hash_end = remaining.find('&').unwrap_or(remaining.len());
        let hash = &remaining[..hash_end];

        // Hash should be 40 hex chars or 32 base32 chars
        if hash.len() >= 32 {
            return Some(hash.to_lowercase());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_hash_from_magnet() {
        let magnet = "magnet:?xt=urn:btih:ABC123DEF456ABC123DEF456ABC123DEF456ABC1&dn=test";
        let hash = extract_hash_from_magnet(magnet);
        assert!(hash.is_some());
        assert_eq!(
            hash.unwrap(),
            "abc123def456abc123def456abc123def456abc1"
        );
    }

    #[test]
    fn test_extract_hash_no_hash() {
        let magnet = "magnet:?dn=test";
        let hash = extract_hash_from_magnet(magnet);
        assert!(hash.is_none());
    }

    #[test]
    fn test_convert_status() {
        assert_eq!(
            RealDebridProvider::convert_status("downloading"),
            TorrentStatusKind::Downloading
        );
        assert_eq!(
            RealDebridProvider::convert_status("downloaded"),
            TorrentStatusKind::Ready
        );
        assert_eq!(
            RealDebridProvider::convert_status("error"),
            TorrentStatusKind::Error
        );
        assert_eq!(
            RealDebridProvider::convert_status("queued"),
            TorrentStatusKind::Downloading
        );
    }

    #[test]
    fn test_provider_info() {
        let provider = RealDebridProvider::new();
        assert_eq!(provider.id(), "real_debrid");
        assert_eq!(provider.name(), "Real-Debrid");
        assert_eq!(provider.website_url(), "https://real-debrid.com");
    }
}

