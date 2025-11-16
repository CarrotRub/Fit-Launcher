use crate::errors::RealDebridApiError;
use crate::structs::{
    AddMagnetResponse, SelectFilesRequest, TorrentFilesResponse, TorrentInfo,
    UnrestrictLinkResponse,
};
use reqwest::Client;
use std::time::Duration;
use tracing::{error, warn};

const BASE_URL: &str = "https://api.real-debrid.com/rest/1.0";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

pub struct RealDebridClient {
    client: Client,
    api_token: String,
}

impl RealDebridClient {
    pub fn new(api_token: String) -> Self {
        let client = Client::builder()
            .timeout(DEFAULT_TIMEOUT)
            .build()
            .expect("Failed to create HTTP client");

        Self { client, api_token }
    }

    async fn request<T>(
        &self,
        method: reqwest::Method,
        endpoint: &str,
        body: Option<&str>,
    ) -> Result<T, RealDebridApiError>
    where
        T: serde::de::DeserializeOwned,
    {
        let url = format!("{}{}", BASE_URL, endpoint);
        let mut request = self
            .client
            .request(method.clone(), &url)
            .header("Authorization", format!("Bearer {}", self.api_token));

        if let Some(body_str) = body {
            request = request
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(body_str.to_string());
        }

        let response = request.send().await.map_err(|e| {
            error!("Network error: {}", e);
            RealDebridApiError::NetworkError(e.to_string())
        })?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            
            return match status.as_u16() {
                401 => Err(RealDebridApiError::AuthenticationError(
                    format!("Unauthorized: {}", error_text),
                )),
                403 => Err(RealDebridApiError::InvalidToken),
                429 => {
                    warn!("Rate limit exceeded: {}", error_text);
                    Err(RealDebridApiError::RateLimitError)
                }
                404 => Err(RealDebridApiError::TorrentNotFound),
                _ => {
                    error!("API error {}: {}", status, error_text);
                    Err(RealDebridApiError::ApiError(format!(
                        "HTTP {}: {}",
                        status, error_text
                    )))
                }
            };
        }

        let text = response.text().await.map_err(|e| {
            error!("Failed to read response: {}", e);
            RealDebridApiError::NetworkError(e.to_string())
        })?;

        // Handle empty responses
        if text.trim().is_empty() {
            // For empty responses, we need to handle them specially
            // This is a workaround - we'll handle empty responses in specific methods
            return Err(RealDebridApiError::ApiError(
                "Empty response from API".to_string(),
            ));
        }

        serde_json::from_str(&text).map_err(|e| {
            error!("Failed to parse JSON: {} - Response: {}", e, text);
            RealDebridApiError::ApiError(format!("JSON parse error: {}", e))
        })
    }

    async fn request_empty(
        &self,
        method: reqwest::Method,
        endpoint: &str,
        body: Option<&str>,
    ) -> Result<(), RealDebridApiError> {
        let url = format!("{}{}", BASE_URL, endpoint);
        let mut request = self
            .client
            .request(method.clone(), &url)
            .header("Authorization", format!("Bearer {}", self.api_token));

        if let Some(body_str) = body {
            request = request
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(body_str.to_string());
        }

        let response = request.send().await.map_err(|e| {
            error!("Network error: {}", e);
            RealDebridApiError::NetworkError(e.to_string())
        })?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            
            return match status.as_u16() {
                401 => Err(RealDebridApiError::AuthenticationError(
                    format!("Unauthorized: {}", error_text),
                )),
                403 => Err(RealDebridApiError::InvalidToken),
                429 => {
                    warn!("Rate limit exceeded: {}", error_text);
                    Err(RealDebridApiError::RateLimitError)
                }
                404 => Err(RealDebridApiError::TorrentNotFound),
                _ => {
                    error!("API error {}: {}", status, error_text);
                    Err(RealDebridApiError::ApiError(format!(
                        "HTTP {}: {}",
                        status, error_text
                    )))
                }
            };
        }

        // For empty responses, we just check status code
        let _text = response.text().await.map_err(|e| {
            error!("Failed to read response: {}", e);
            RealDebridApiError::NetworkError(e.to_string())
        })?;

        Ok(())
    }

    pub async fn add_magnet(&self, magnet: &str) -> Result<AddMagnetResponse, RealDebridApiError> {
        if !magnet.starts_with("magnet:") {
            return Err(RealDebridApiError::InvalidMagnet);
        }

        let body = format!("magnet={}", urlencoding::encode(magnet));
        self.request(reqwest::Method::POST, "/torrents/addMagnet", Some(&body))
            .await
    }

    pub async fn get_torrent_info(&self, id: &str) -> Result<TorrentInfo, RealDebridApiError> {
        let endpoint = format!("/torrents/info/{}", id);
        self.request(reqwest::Method::GET, &endpoint, None).await
    }

    pub async fn get_torrent_files(
        &self,
        id: &str,
    ) -> Result<TorrentFilesResponse, RealDebridApiError> {
        let endpoint = format!("/torrents/info/{}", id);
        self.request(reqwest::Method::GET, &endpoint, None).await
    }

    pub async fn select_files(
        &self,
        id: &str,
        file_ids: &[u32],
    ) -> Result<(), RealDebridApiError> {
        if file_ids.is_empty() {
            return Err(RealDebridApiError::ApiError(
                "No files selected".to_string(),
            ));
        }

        let files_str = file_ids
            .iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(",");
        let body = format!("files={}", files_str);

        let endpoint = format!("/torrents/selectFiles/{}", id);
        
        // Real-Debrid API may return empty response for select_files
        // Try to parse as JSON first, if empty use request_empty
        match self
            .request::<serde_json::Value>(reqwest::Method::POST, &endpoint, Some(&body))
            .await
        {
            Ok(_) => Ok(()),
            Err(RealDebridApiError::ApiError(msg)) if msg.contains("Empty response") => {
                // Fallback to empty request handler
                self.request_empty(reqwest::Method::POST, &endpoint, Some(&body))
                    .await
            }
            Err(e) => Err(e),
        }
    }

    pub async fn get_download_links(
        &self,
        link: &str,
    ) -> Result<UnrestrictLinkResponse, RealDebridApiError> {
        let body = format!("link={}", urlencoding::encode(link));
        self.request(reqwest::Method::POST, "/unrestrict/link", Some(&body))
            .await
    }

    pub async fn wait_for_torrent_ready(
        &self,
        id: &str,
        max_wait_seconds: u64,
    ) -> Result<TorrentFilesResponse, RealDebridApiError> {
        let start = std::time::Instant::now();
        let poll_interval = Duration::from_secs(5);

        loop {
            let info = self.get_torrent_files(id).await?;

            if info.status == "downloaded" {
                return Ok(info);
            }

            if info.status == "error" || info.status == "dead" {
                return Err(RealDebridApiError::ApiError(format!(
                    "Torrent status: {}",
                    info.status
                )));
            }

            if start.elapsed().as_secs() >= max_wait_seconds {
                return Err(RealDebridApiError::TorrentProcessingTimeout);
            }

            tokio::time::sleep(poll_interval).await;
        }
    }
}
