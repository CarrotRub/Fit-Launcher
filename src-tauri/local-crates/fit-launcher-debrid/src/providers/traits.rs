use async_trait::async_trait;
use fit_launcher_ddl::DirectLink;

use crate::{
    error::DebridError, DebridTorrentInfo, ProviderInfo, SubscriptionInfo, TorrentStatus,
};

/// Trait that all debrid providers must implement
///
/// This trait defines the common interface for interacting with debrid services.
/// Each provider (Real-Debrid, AllDebrid, etc.) implements this trait.
#[async_trait]
pub trait DebridProvider: Send + Sync {
    /// Get the unique identifier for this provider
    fn id(&self) -> &'static str;

    /// Get the display name for this provider
    fn name(&self) -> &'static str;

    /// Get provider information
    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            id: self.id().to_string(),
            name: self.name().to_string(),
            website_url: self.website_url().to_string(),
        }
    }

    /// Get the website URL for this provider
    fn website_url(&self) -> &'static str;

    /// Validate an API key
    ///
    /// Returns `Ok(true)` if the key is valid, `Ok(false)` if invalid,
    /// or an error if the validation request failed.
    async fn validate_api_key(&self, api_key: &str) -> Result<bool, DebridError>;

    /// Get subscription information for the authenticated user
    async fn get_subscription_info(&self, api_key: &str) -> Result<SubscriptionInfo, DebridError>;

    /// Add a magnet link to the debrid service
    ///
    /// Returns the remote ID of the torrent on the debrid service.
    async fn add_magnet(&self, api_key: &str, magnet: &str) -> Result<String, DebridError>;

    /// Get the current status of a torrent
    async fn get_torrent_status(
        &self,
        api_key: &str,
        remote_id: &str,
    ) -> Result<TorrentStatus, DebridError>;

    /// Get detailed information about a torrent including files
    async fn get_torrent_info(
        &self,
        api_key: &str,
        remote_id: &str,
    ) -> Result<DebridTorrentInfo, DebridError>;

    /// Select which files to download from the torrent
    ///
    /// Pass an empty slice to select all files.
    async fn select_files(
        &self,
        api_key: &str,
        remote_id: &str,
        file_indices: &[usize],
    ) -> Result<(), DebridError>;

    /// Get direct download links for a ready torrent
    ///
    /// This may involve "unrestricting" links depending on the provider.
    async fn get_download_links(
        &self,
        api_key: &str,
        remote_id: &str,
    ) -> Result<Vec<DirectLink>, DebridError>;

    /// Delete a torrent from the debrid service
    async fn delete_torrent(&self, api_key: &str, remote_id: &str) -> Result<(), DebridError>;

    /// Check if a magnet link is supported/cached by this provider
    ///
    /// Returns `Ok(true)` if the torrent is already cached on the provider.
    async fn is_cached(&self, api_key: &str, magnet: &str) -> Result<bool, DebridError> {
        // Default implementation: assume not cached
        // Providers can override with actual cache check
        let _ = (api_key, magnet);
        Ok(false)
    }
}

