use async_trait::async_trait;
use chrono::{TimeZone, Utc};
use fit_launcher_ddl::DirectLink;
use reqwest::Client;
use serde::Deserialize;
use tracing::{debug, error, warn};

use crate::{
    DebridError, DebridFile, DebridProvider, DebridTorrentInfo, SubscriptionInfo, TorrentStatus,
    TorrentStatusKind,
};

const BASE_URL: &str = "https://api.alldebrid.com/v4";
const AGENT: &str = "FitLauncher";

/// AllDebrid API provider implementation
pub struct AllDebridProvider {
    client: Client,
}

impl AllDebridProvider {
    /// Create a new AllDebrid provider instance
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
        extra_params: &[(&str, &str)],
    ) -> Result<T, DebridError> {
        let url = format!("{}{}", BASE_URL, endpoint);
        debug!("AllDebrid GET: {}", url);

        let mut request = self
            .client
            .get(&url)
            .query(&[("agent", AGENT), ("apikey", api_key)]);

        for (key, value) in extra_params {
            request = request.query(&[(key, value)]);
        }

        let response = request.send().await?;
        self.handle_response(response).await
    }

    /// Handle API response and parse errors
    async fn handle_response<T: for<'de> Deserialize<'de>>(
        &self,
        response: reqwest::Response,
    ) -> Result<T, DebridError> {
        let _status = response.status();
        let text = response.text().await?;
        debug!("AllDebrid response: {}", text);

        // AllDebrid always returns JSON with status field
        let wrapper: AdApiResponse<T> = serde_json::from_str(&text).map_err(|e| {
            error!("Failed to parse AllDebrid response: {} - {}", e, text);
            DebridError::InternalError(format!("JSON parse error: {}", e))
        })?;

        if wrapper.status == "success" {
            wrapper.data.ok_or_else(|| {
                DebridError::InternalError("Missing data in success response".to_string())
            })
        } else {
            let error = wrapper.error.unwrap_or_default();
            Err(self.parse_error(&error.code, &error.message.unwrap_or_default()))
        }
    }

    /// Parse error response from AllDebrid
    fn parse_error(&self, code: &str, message: &str) -> DebridError {
        match code {
            "AUTH_MISSING_APIKEY" | "AUTH_BAD_APIKEY" | "AUTH_USER_BANNED" => {
                DebridError::InvalidApiKey
            }
            "AUTH_BLOCKED" => DebridError::RateLimited(60),
            "NO_SERVER" | "MAGNET_INVALID" | "MAGNET_MUST_BE_PREMIUM" => {
                DebridError::MagnetNotSupported
            }
            "MAGNET_NO_URI" | "MAGNET_PROCESSING" => {
                DebridError::ConversionFailed(message.to_string())
            }
            "MAGNET_TOO_MANY" => DebridError::QuotaExceeded,
            "FREE_TRIAL_LIMIT_REACHED" | "MUST_BE_PREMIUM" => DebridError::SubscriptionExpired,
            "LINK_HOST_NOT_SUPPORTED" | "LINK_DOWN" | "LINK_PASS_PROTECTED" => {
                DebridError::MagnetNotSupported
            }
            "LINK_HOST_UNAVAILABLE" | "LINK_HOST_FULL" => {
                DebridError::ConversionFailed(message.to_string())
            }
            _ => DebridError::ApiError {
                code: 0,
                message: format!("{}: {}", code, message),
            },
        }
    }

    /// Convert AllDebrid magnet status to our status enum
    fn convert_status(status: &str, status_code: i32) -> TorrentStatusKind {
        match status_code {
            0 => TorrentStatusKind::Queued,       // Processing
            1 => TorrentStatusKind::Downloading,  // Downloading
            2 => TorrentStatusKind::Processing,   // Compressing
            3 => TorrentStatusKind::Processing,   // Uploading
            4 => TorrentStatusKind::Ready,        // Ready
            5 => TorrentStatusKind::Error,        // Error
            6 => TorrentStatusKind::Error,        // Virus
            7 => TorrentStatusKind::Error,        // Dead
            _ => match status.to_lowercase().as_str() {
                "ready" => TorrentStatusKind::Ready,
                "downloading" => TorrentStatusKind::Downloading,
                "error" | "virus" | "dead" => TorrentStatusKind::Error,
                _ => TorrentStatusKind::Processing,
            },
        }
    }
}

impl Default for AllDebridProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DebridProvider for AllDebridProvider {
    fn id(&self) -> &'static str {
        "all_debrid"
    }

    fn name(&self) -> &'static str {
        "AllDebrid"
    }

    fn website_url(&self) -> &'static str {
        "https://alldebrid.com"
    }

    async fn validate_api_key(&self, api_key: &str) -> Result<bool, DebridError> {
        match self.get::<AdUserData>(api_key, "/user", &[]).await {
            Ok(_) => Ok(true),
            Err(DebridError::InvalidApiKey) => Ok(false),
            Err(e) => Err(e),
        }
    }

    async fn get_subscription_info(&self, api_key: &str) -> Result<SubscriptionInfo, DebridError> {
        let user: AdUserData = self.get(api_key, "/user", &[]).await?;

        let expires_at = user.premium_until.and_then(|ts| {
            Utc.timestamp_opt(ts, 0).single()
        });

        Ok(SubscriptionInfo {
            is_premium: user.is_premium,
            expires_at,
            points: user.fidelity_points.map(|p| p as i64),
            username: Some(user.username),
        })
    }

    async fn add_magnet(&self, api_key: &str, magnet: &str) -> Result<String, DebridError> {
        let response: AdMagnetUploadData = self
            .get(api_key, "/magnet/upload", &[("magnets[]", magnet)])
            .await?;

        // Response contains array of magnets, we only sent one
        let magnet_info = response
            .magnets
            .into_iter()
            .next()
            .ok_or_else(|| DebridError::InternalError("No magnet returned".to_string()))?;

        if let Some(error) = magnet_info.error {
            return Err(DebridError::ConversionFailed(format!(
                "Magnet error: {} - {}",
                error.code,
                error.message.unwrap_or_default()
            )));
        }

        let id = magnet_info
            .id
            .ok_or_else(|| DebridError::InternalError("No magnet ID returned".to_string()))?;

        debug!("AllDebrid added magnet with ID: {}", id);
        Ok(id.to_string())
    }

    async fn get_torrent_status(
        &self,
        api_key: &str,
        remote_id: &str,
    ) -> Result<TorrentStatus, DebridError> {
        let response: AdMagnetStatusData = self
            .get(api_key, "/magnet/status", &[("id", remote_id)])
            .await?;

        let magnets = response.magnets;
        let info = if let Some(magnet) = magnets.into_iter().next() {
            magnet
        } else {
            return Err(DebridError::TorrentNotFound);
        };

        let status_kind = Self::convert_status(&info.status, info.status_code);

        Ok(TorrentStatus {
            id: info.id.to_string(),
            status: status_kind,
            progress: info.downloaded as f64 / info.size.max(1) as f64 * 100.0,
            speed: info.download_speed.map(|s| s as u64),
            size: Some(info.size as u64),
            files_count: info.links.as_ref().map(|l| l.len()),
            error_message: if info.status_code >= 5 {
                Some(format!("Error status: {}", info.status))
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
        let response: AdMagnetStatusData = self
            .get(api_key, "/magnet/status", &[("id", remote_id)])
            .await?;

        let info = response
            .magnets
            .into_iter()
            .next()
            .ok_or(DebridError::TorrentNotFound)?;

        let status = TorrentStatus {
            id: info.id.to_string(),
            status: Self::convert_status(&info.status, info.status_code),
            progress: info.downloaded as f64 / info.size.max(1) as f64 * 100.0,
            speed: info.download_speed.map(|s| s as u64),
            size: Some(info.size as u64),
            files_count: info.links.as_ref().map(|l| l.len()),
            error_message: None,
        };

        let files = info
            .links
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(i, link)| DebridFile {
                index: i,
                name: link.filename.clone(),
                size: link.size as u64,
                selected: true, // AllDebrid doesn't have file selection
                link: Some(link.link.clone()),
            })
            .collect();

        let added_at = info.upload_date.and_then(|ts| Utc.timestamp_opt(ts, 0).single());

        Ok(DebridTorrentInfo {
            id: info.id.to_string(),
            magnet: info.hash.unwrap_or_default(),
            name: info.filename,
            status,
            files,
            added_at,
        })
    }

    async fn select_files(
        &self,
        _api_key: &str,
        _remote_id: &str,
        _file_indices: &[usize],
    ) -> Result<(), DebridError> {
        // AllDebrid doesn't support file selection - all files are downloaded
        // This is a no-op
        debug!("AllDebrid: select_files is a no-op (all files selected by default)");
        Ok(())
    }

    async fn get_download_links(
        &self,
        api_key: &str,
        remote_id: &str,
    ) -> Result<Vec<DirectLink>, DebridError> {
        let response: AdMagnetStatusData = self
            .get(api_key, "/magnet/status", &[("id", remote_id)])
            .await?;

        let info = response
            .magnets
            .into_iter()
            .next()
            .ok_or(DebridError::TorrentNotFound)?;

        // Check if ready
        if info.status_code != 4 {
            return Err(DebridError::ConversionFailed(format!(
                "Torrent not ready, status: {}",
                info.status
            )));
        }

        let links = info.links.ok_or_else(|| {
            DebridError::ConversionFailed("No download links available".to_string())
        })?;

        // Unlock each link to get direct download URL
        let mut direct_links = Vec::with_capacity(links.len());
        for link in links {
            match self.unlock_link(api_key, &link.link).await {
                Ok(dl) => direct_links.push(dl),
                Err(e) => {
                    warn!("Failed to unlock link {}: {:?}", link.link, e);
                    // Continue with other links
                }
            }
        }

        if direct_links.is_empty() {
            return Err(DebridError::ConversionFailed(
                "Failed to unlock any links".to_string(),
            ));
        }

        Ok(direct_links)
    }

    async fn delete_torrent(&self, api_key: &str, remote_id: &str) -> Result<(), DebridError> {
        let _: AdDeleteResponse = self
            .get(api_key, "/magnet/delete", &[("id", remote_id)])
            .await?;
        Ok(())
    }

    async fn is_cached(&self, api_key: &str, magnet: &str) -> Result<bool, DebridError> {
        // Extract hash from magnet
        let hash = extract_hash_from_magnet(magnet);
        if hash.is_none() {
            return Ok(false);
        }
        let hash = hash.unwrap();

        let response: AdInstantData = self
            .get(api_key, "/magnet/instant", &[("magnets[]", &hash)])
            .await?;

        // Check if any magnet is instant available
        Ok(response.magnets.iter().any(|m| m.instant))
    }
}

impl AllDebridProvider {
    /// Unlock a link to get direct download URL
    async fn unlock_link(&self, api_key: &str, link: &str) -> Result<DirectLink, DebridError> {
        let response: AdUnlockData = self
            .get(api_key, "/link/unlock", &[("link", link)])
            .await?;

        Ok(DirectLink {
            url: response.link,
            filename: response.filename,
            size: response.filesize as u64,
        })
    }
}

// ============================================================================
// AllDebrid API Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
struct AdApiResponse<T> {
    status: String,
    data: Option<T>,
    error: Option<AdError>,
}

#[derive(Debug, Deserialize, Default)]
struct AdError {
    code: String,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AdUserData {
    username: String,
    #[serde(rename = "isPremium")]
    is_premium: bool,
    #[serde(rename = "premiumUntil")]
    premium_until: Option<i64>,
    #[serde(rename = "fidelityPoints")]
    fidelity_points: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct AdMagnetUploadData {
    magnets: Vec<AdMagnetUploadResult>,
}

#[derive(Debug, Deserialize)]
struct AdMagnetUploadResult {
    id: Option<i64>,
    #[allow(dead_code)]
    name: Option<String>,
    #[allow(dead_code)]
    hash: Option<String>,
    #[allow(dead_code)]
    ready: Option<bool>,
    error: Option<AdError>,
}

#[derive(Debug, Deserialize)]
struct AdMagnetStatusData {
    magnets: Vec<AdMagnetInfo>,
}

#[derive(Debug, Deserialize)]
struct AdMagnetInfo {
    id: i64,
    filename: String,
    size: i64,
    hash: Option<String>,
    status: String,
    #[serde(rename = "statusCode")]
    status_code: i32,
    downloaded: i64,
    #[serde(rename = "downloadSpeed")]
    download_speed: Option<i64>,
    #[serde(rename = "uploadDate")]
    upload_date: Option<i64>,
    links: Option<Vec<AdMagnetLink>>,
}

#[derive(Debug, Deserialize)]
struct AdMagnetLink {
    filename: String,
    size: i64,
    link: String,
}

#[derive(Debug, Deserialize)]
struct AdUnlockData {
    link: String,
    filename: String,
    filesize: i64,
}

#[derive(Debug, Deserialize)]
struct AdDeleteResponse {
    #[allow(dead_code)]
    message: String,
}

#[derive(Debug, Deserialize)]
struct AdInstantData {
    magnets: Vec<AdInstantMagnet>,
}

#[derive(Debug, Deserialize)]
struct AdInstantMagnet {
    #[allow(dead_code)]
    magnet: String,
    #[allow(dead_code)]
    hash: Option<String>,
    instant: bool,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Extract the info hash from a magnet link
fn extract_hash_from_magnet(magnet: &str) -> Option<String> {
    if let Some(start) = magnet.find("xt=urn:btih:") {
        let hash_start = start + 12;
        let remaining = &magnet[hash_start..];
        let hash_end = remaining.find('&').unwrap_or(remaining.len());
        let hash = &remaining[..hash_end];
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
        assert_eq!(hash.unwrap(), "abc123def456abc123def456abc123def456abc1");
    }

    #[test]
    fn test_convert_status() {
        assert_eq!(
            AllDebridProvider::convert_status("downloading", 1),
            TorrentStatusKind::Downloading
        );
        assert_eq!(
            AllDebridProvider::convert_status("ready", 4),
            TorrentStatusKind::Ready
        );
        assert_eq!(
            AllDebridProvider::convert_status("error", 5),
            TorrentStatusKind::Error
        );
    }

    #[test]
    fn test_provider_info() {
        let provider = AllDebridProvider::new();
        assert_eq!(provider.id(), "all_debrid");
        assert_eq!(provider.name(), "AllDebrid");
        assert_eq!(provider.website_url(), "https://alldebrid.com");
    }
}

