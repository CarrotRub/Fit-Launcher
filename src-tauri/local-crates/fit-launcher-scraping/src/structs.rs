use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use specta::Type;

/// Game data extracted from FitGirl Repacks pages.
///
/// This unified struct is used for all game contexts:
/// - Newly added games
/// - Popular games
/// - Recently updated games
/// - Discovery carousel games (uses secondary_images field)
#[derive(Default, Debug, Serialize, Deserialize, Type, Clone)]
#[serde(default)]
pub struct Game {
    pub title: String,
    pub img: String,
    /// Game details: genres/tags, companies, languages, original size, repack size
    pub details: String,
    /// Repack features section
    pub features: String,
    /// Game description (the actual game info)
    pub description: String,
    /// Gameplay features extracted from description
    pub gameplay_features: String,
    /// Included DLCs section
    pub included_dlcs: String,
    pub magnetlink: String,
    pub href: String,
    pub tag: String,
    /// Secondary images for discovery view (empty for non-discovery games)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub secondary_images: Vec<String>,
    #[serde(default)]
    pub pastebin_link: String,
}

#[derive(Debug, specta::Type, Serialize, Deserialize)]
pub struct InstalledEntry {
    /// (database) Url hash
    pub url_hash: Option<i64>,
    /// display name of game
    pub name: String,
    /// install date, `YYYYMMDD`
    pub install_date: String,
    /// installed directory
    pub location: PathBuf,
    /// installation size, in KiB
    pub size: u32,
    /// inno setup version
    pub version: String,
}
