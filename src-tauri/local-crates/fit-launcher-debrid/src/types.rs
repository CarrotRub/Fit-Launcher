use chrono::{DateTime, Utc};
use fit_launcher_ddl::DirectLink;
use serde::{Deserialize, Serialize};
use specta::Type;

/// Information about a debrid provider
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProviderInfo {
    /// Unique identifier for the provider (e.g., "real_debrid", "all_debrid")
    pub id: String,
    /// Display name (e.g., "Real-Debrid", "AllDebrid")
    pub name: String,
    /// Website URL for the provider
    pub website_url: String,
}

/// Subscription information from a debrid provider
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SubscriptionInfo {
    /// Whether the user has an active premium subscription
    pub is_premium: bool,
    /// When the subscription expires (if premium)
    pub expires_at: Option<DateTime<Utc>>,
    /// Available points/credits (provider-specific)
    pub points: Option<i64>,
    /// Username on the service
    pub username: Option<String>,
}

/// Status of a torrent being processed by a debrid service
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
pub enum TorrentStatusKind {
    /// Torrent is queued for processing
    Queued,
    /// Torrent is being downloaded by the debrid service
    Downloading,
    /// Torrent is being processed/converted
    Processing,
    /// Torrent is ready for download
    Ready,
    /// Torrent processing failed
    Error,
    /// Torrent was deleted
    Deleted,
}

/// Detailed status of a torrent on a debrid service
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TorrentStatus {
    /// Remote ID on the debrid service
    pub id: String,
    /// Current status
    pub status: TorrentStatusKind,
    /// Progress percentage (0-100)
    pub progress: f64,
    /// Download speed (bytes/s) on the debrid service
    pub speed: Option<u64>,
    /// Total size in bytes
    pub size: Option<u64>,
    /// Number of files in the torrent
    pub files_count: Option<usize>,
    /// Error message if status is Error
    pub error_message: Option<String>,
}

/// Information about a file in a debrid torrent
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridFile {
    /// File index in the torrent
    pub index: usize,
    /// File name
    pub name: String,
    /// File size in bytes
    pub size: u64,
    /// Whether the file is selected for download
    pub selected: bool,
    /// Direct download link (available when ready)
    pub link: Option<String>,
}

/// Complete information about a torrent on a debrid service
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridTorrentInfo {
    /// Remote ID on the debrid service
    pub id: String,
    /// Original magnet link
    pub magnet: String,
    /// Torrent name/title
    pub name: String,
    /// Current status
    pub status: TorrentStatus,
    /// Files in the torrent
    pub files: Vec<DebridFile>,
    /// When the torrent was added
    pub added_at: Option<DateTime<Utc>>,
}

/// Result of unrestricting a link (getting the final download URL)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UnrestrictedLink {
    /// Original link that was unrestricted
    pub original: String,
    /// Final direct download URL
    pub download_url: String,
    /// File name
    pub filename: String,
    /// File size in bytes
    pub size: u64,
    /// MIME type if available
    pub mime_type: Option<String>,
}

impl From<UnrestrictedLink> for DirectLink {
    fn from(link: UnrestrictedLink) -> Self {
        DirectLink {
            url: link.download_url,
            filename: link.filename,
            size: link.size,
        }
    }
}

/// Configuration for a debrid provider
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct DebridProviderConfig {
    /// Provider ID
    pub provider_id: String,
    /// Whether this provider is enabled
    pub enabled: bool,
    /// API key (should be stored securely)
    pub api_key: Option<String>,
}

/// Global debrid settings
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct DebridSettings {
    /// Configured providers
    pub providers: Vec<DebridProviderConfig>,
    /// Default provider to use
    pub default_provider: Option<String>,
    /// Whether to automatically fall back to torrent if debrid fails
    pub auto_fallback: bool,
}

/// Event emitted during debrid conversion
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DebridConversionEvent {
    /// Job ID in the download manager
    pub job_id: String,
    /// Provider being used
    pub provider: String,
    /// Current status
    pub status: TorrentStatusKind,
    /// Progress percentage
    pub progress: f64,
    /// Error message if failed
    pub error: Option<String>,
}

