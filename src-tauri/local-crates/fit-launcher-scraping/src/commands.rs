//! Tauri commands for scraping operations.
//!
//! These are thin adapters that delegate to core logic modules.

use specta::specta;
use std::time::Instant;
use tauri::AppHandle;
use tracing::info;

use crate::db::{self, SearchIndexEntry};
use crate::errors::ScrapingError;
use crate::parser::parse_game_from_article;
use crate::structs::Game;

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
    if let Ok(deleted) = db::cleanup_expired_games(&conn, CACHE_EXPIRY_SECS) {
        if deleted > 0 {
            info!("Cleaned up {} expired game cache entries", deleted);
        }
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

    let game = tokio::task::spawn_blocking(move || -> Result<Game, ScrapingError> {
        let doc = Html::parse_document(&body);
        let article = doc
            .select(&scraper::Selector::parse("article").unwrap())
            .next()
            .ok_or(ScrapingError::ArticleNotFound(game_link))?;
        Ok(parse_game_from_article(article))
    })
    .await
    .unwrap()?;

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
