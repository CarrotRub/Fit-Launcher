//! Tauri commands for scraping operations.
//!
//! These are thin adapters that delegate to core logic modules.

use futures::{StreamExt as _, stream};
use specta::specta;
use std::time::Instant;
use tauri::AppHandle;
use tracing::info;

use crate::db::{self, SearchIndexEntry};
use crate::discovery::try_high_res_img;
use crate::errors::ScrapingError;
use crate::parser::parse_game_from_article;
use crate::structs::Game;
use crate::structs::InstalledEntry;

/// Find local installed games
#[tauri::command]
#[specta]
#[cfg(windows)]
pub fn find_local_games(app: AppHandle) -> Result<Vec<InstalledEntry>, ScrapingError> {
    use std::error::Error;
    use std::path::PathBuf;

    use winreg::{RegKey, enums::HKEY_LOCAL_MACHINE};

    let conn = db::open_connection(&app)?;
    let games = db::list_all_games(&conn)?;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let uninstall =
        hklm.open_subkey(r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall")?;

    let local_entries: Vec<InstalledEntry> = uninstall
        .enum_keys()
        .flatten()
        .filter(|keyname| keyname.ends_with("_is1"))
        .flat_map(|keyname| -> Result<InstalledEntry, Box<dyn Error>> {
            let regkey = uninstall.open_subkey(keyname)?;

            let name: String = regkey.get_value("DisplayName")?;
            let size: u32 = regkey.get_value("EstimatedSize")?;
            let install_date: String = regkey.get_value("InstallDate")?;
            let location: PathBuf =
                PathBuf::from(regkey.get_value::<String, _>("InstallLocation")?);
            let version: String = regkey.get_value("Inno Setup: Setup Version")?;

            Ok(InstalledEntry {
                name,
                location,
                install_date,
                version,
                size,
                url_hash: None,
            })
        })
        .filter(|e| e.version.starts_with("5.5"))
        .filter(|e| e.location.exists())
        .filter_map(|e| {
            let name = e.name.chars().collect::<Vec<_>>();

            let meta = games
                .iter()
                .find(|&meta| sorensen::distance(&meta.title, &name) >= 0.8)?;

            Some(InstalledEntry {
                url_hash: Some(meta.url_hash),
                ..e
            })
        })
        .collect();

    Ok(local_entries)
}

/// Find local installed games
#[tauri::command]
#[specta]
#[cfg(not(windows))]
pub fn find_local_games(app: AppHandle) -> Result<Vec<InstalledEntry>, ScrapingError> {
    Ok(vec![])
}

// ============================================================================
// Game Data Commands
// ============================================================================

#[tauri::command]
#[specta]
pub fn get_newly_added_games(app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    let conn = db::open_connection(&app)?;
    db::get_games_by_category(&conn, "newly_added")
}

#[tauri::command]
#[specta]
pub fn clear_game_cache(app: AppHandle) -> Result<(), ScrapingError> {
    let conn = db::open_connection(&app)?;
    db::clear_game_cache(&conn)?;
    info!("Game cache cleared");
    Ok(())
}

#[tauri::command]
#[specta]
pub fn get_popular_games(app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    let conn = db::open_connection(&app)?;
    db::get_games_by_category(&conn, "popular")
}

#[tauri::command]
#[specta]
pub fn get_recently_updated_games(app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    let conn = db::open_connection(&app)?;
    db::get_games_by_category(&conn, "recently_updated")
}

#[tauri::command]
#[specta]
pub fn get_discovery_games(app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    let conn = db::open_connection(&app)?;
    db::get_games_by_category(&conn, "discovery")
}

#[tauri::command]
#[specta]
pub fn get_singular_game_local(app: AppHandle, url: &str) -> Result<Game, ScrapingError> {
    let conn = db::open_connection(&app)?;
    let url_hash = db::hash_url(url);

    match db::get_game_by_hash(&conn, url_hash)? {
        Some(game) => Ok(game),
        None => Err(ScrapingError::IOError(format!(
            "Game not found in cache: {}",
            url
        ))),
    }
}

// ============================================================================
// Scraping Commands
// ============================================================================

/// unique 16 bytes text ID for a game URL
#[tauri::command]
#[specta]
pub fn hash_url(url: &str) -> String {
    let hash = db::hash_url(url) as u64;
    format!("{hash:016x}")
}

#[tauri::command]
#[specta]
pub async fn get_singular_game_info(
    app: tauri::AppHandle,
    game_link: String,
) -> Result<(), ScrapingError> {
    use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
    use scraper::Html;

    let start_time = Instant::now();
    let url = game_link.clone();
    let url_hash = db::hash_url(&url);

    let conn = db::open_connection(&app)?;

    // Clean up expired cache entries (24 hours)
    const CACHE_EXPIRY_SECS: i64 = 60 * 60 * 24;
    if let Ok(deleted) = db::cleanup_expired_games(&conn, CACHE_EXPIRY_SECS)
        && deleted > 0
    {
        info!("Cleaned up {} expired game cache entries", deleted);
    }

    // Check if we have a valid cached version
    if db::is_game_cache_valid(&conn, url_hash, CACHE_EXPIRY_SECS)? {
        info!("Using cached game info for {}", url_hash);
        return Ok(());
    }

    // Fetch fresh data
    let response = CUSTOM_DNS_CLIENT
        .read()
        .await
        .get(&url)
        .send()
        .await
        .map_err(|e| ScrapingError::HttpStatusCodeError(e.to_string()))?;

    let body = response
        .text()
        .await
        .map_err(|e| ScrapingError::HttpStatusCodeError(e.to_string()))?;

    let mut game = tokio::task::spawn_blocking(move || -> Result<Game, ScrapingError> {
        let doc = Html::parse_document(&body);
        let article = doc
            .select(&scraper::Selector::parse("article").unwrap())
            .next()
            .ok_or(ScrapingError::ArticleNotFound(game_link))?;
        Ok(parse_game_from_article(article))
    })
    .await
    .unwrap()?;

    // Try enhance image quality
    game.secondary_images = stream::iter(game.secondary_images.clone())
        .map(|s| async move { try_high_res_img(&s).await })
        .buffer_unordered(5)
        .collect::<Vec<_>>()
        .await;

    // Write to cache
    db::upsert_game(&conn, url_hash, &game)?;

    info!(
        "Game data cached for {} in {:#?}",
        url_hash,
        start_time.elapsed()
    );

    Ok(())
}

// ============================================================================
// Search Commands
// ============================================================================

#[tauri::command]
#[specta]
pub async fn rebuild_search_index(app: AppHandle) -> Result<(), ScrapingError> {
    crate::sitemap::build_search_index(&app).await
}

#[tauri::command]
#[specta]
pub fn get_search_index_path_cmd(app: AppHandle) -> String {
    db::get_db_path(&app).to_string_lossy().to_string()
}

#[tauri::command]
#[specta]
pub async fn query_search_index(
    app: AppHandle,
    query: String,
) -> Result<Vec<SearchIndexEntry>, ScrapingError> {
    let db_path = db::get_db_path(&app);

    if !db_path.exists() {
        return Err(ScrapingError::IOError(format!(
            "Search database not found at {}",
            db_path.display()
        )));
    }

    tokio::task::spawn_blocking(move || {
        let conn = db::open_connection_at(&db_path)?;
        db::query_fts(&conn, &query, 25)
    })
    .await
    .map_err(|e| ScrapingError::IOError(e.to_string()))?
}
