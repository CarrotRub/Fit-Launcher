//! Database module for game data storage.
//!
//! Uses SQLite with FTS5 for full-text search. Located at `{app_data_dir}/sitemaps/search.db`.

mod games;
mod search;

use rusqlite::{Connection, OptionalExtension, params};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tracing::info;

use crate::errors::ScrapingError;

pub use games::{
    GameMeta, batch_insert_sitemap_stubs, cleanup_expired_games, clear_all_game_data,
    clear_game_cache, extract_slug, get_game_by_hash, get_game_count, get_games_by_category,
    get_pastebin_by_magnet_hash, insert_sitemap_stub, is_game_cache_valid, list_all_games,
    set_category_games, upsert_game,
};
pub use search::{
    SearchIndexEntry, get_all_games_for_search, initialize_fts, insert_fts_entries, query_fts,
};

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap()
        .join("sitemaps")
        .join("search.db")
}

pub fn open_connection(app: &AppHandle) -> Result<Connection, ScrapingError> {
    let db_path = get_db_path(app);

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(&db_path)?;
    initialize_tables(&conn)?;

    Ok(conn)
}

pub fn open_connection_at(db_path: &PathBuf) -> Result<Connection, ScrapingError> {
    Connection::open(db_path).map_err(|e| ScrapingError::IOError(e.to_string()))
}

/// Deterministic URL hash for primary key. Fixed seeds ensure same URL = same hash.
pub fn hash_url(url: &str) -> i64 {
    let hasher = ahash::RandomState::with_seeds(0x1A, 0x6B, 0x4D, 0xF6);
    hasher.hash_one(url) as _
}

pub fn get_metadata(conn: &Connection, key: &str) -> Result<Option<String>, ScrapingError> {
    let mut stmt = conn.prepare("SELECT value FROM metadata WHERE key = ?1")?;
    let result = stmt.query_row(params![key], |row| row.get(0)).optional()?;
    Ok(result)
}

pub fn set_metadata(conn: &Connection, key: &str, value: &str) -> Result<(), ScrapingError> {
    conn.execute(
        "INSERT INTO metadata (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

fn initialize_tables(conn: &Connection) -> Result<(), ScrapingError> {
    use std::sync::OnceLock;

    // Global lock ensures schema check + migration happens exactly once per process
    static INIT_DONE: OnceLock<Result<(), String>> = OnceLock::new();

    // Get or perform initialization
    let result = INIT_DONE.get_or_init(|| {
        // Check if games table exists and has the required columns
        let needs_migration = check_needs_migration(conn);

        if needs_migration {
            info!("Database schema needs migration, recreating tables...");
            // Drop old tables
            if let Err(e) = conn.execute_batch(
                "DROP TABLE IF EXISTS game_categories;
                 DROP TABLE IF EXISTS games;
                 DROP TABLE IF EXISTS sitemap_urls;
                 DROP TABLE IF EXISTS games_fts;",
            ) {
                return Err(format!("Failed to drop tables: {e}"));
            }
        }

        // Create tables (IF NOT EXISTS is safe)
        if let Err(e) = create_tables(conn) {
            return Err(format!("Failed to create tables: {e}"));
        }

        Ok(())
    });

    // If the first initialization failed, propagate the error
    if let Err(e) = result {
        return Err(ScrapingError::GeneralError(e.clone()));
    }

    // For subsequent connections, just ensure tables exist (no migration check)
    create_tables(conn)?;

    Ok(())
}

/// Check if we need to migrate the database schema.
/// Returns true if migration is needed (old schema or no tables).
fn check_needs_migration(conn: &Connection) -> bool {
    // Check if games table exists
    let table_exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='games'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !table_exists {
        // Fresh database, no migration needed - just create
        return false;
    }

    // Table exists - check if it has all required columns
    let required_columns = [
        "url_hash",
        "href",
        "slug",
        "title",
        "img",
        "details",
        "features",
        "description",
        "gameplay_features",
        "included_dlcs",
        "pastebin_link",
        "magnetlink",
        "tag",
        "secondary_images",
        "is_scraped",
        "source_sitemap",
        "created_at",
        "updated_at",
    ];

    let mut stmt = match conn.prepare("PRAGMA table_info(games)") {
        Ok(s) => s,
        Err(_) => return true, // Can't check, assume migration needed
    };

    let existing_columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    // If any required column is missing, we need migration
    for col in required_columns {
        if !existing_columns.iter().any(|c| c == col) {
            info!("Missing column '{}' in games table", col);
            return true;
        }
    }

    false
}

fn create_tables(conn: &Connection) -> Result<(), ScrapingError> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS games (
            url_hash INTEGER PRIMARY KEY,
            href TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL,
            title TEXT NOT NULL,
            img TEXT,
            details TEXT,
            features TEXT,
            description TEXT,
            gameplay_features TEXT,
            included_dlcs TEXT,
            pastebin_link TEXT,
            magnetlink TEXT,
            tag TEXT,
            secondary_images TEXT,
            is_scraped INTEGER NOT NULL DEFAULT 0,
            source_sitemap TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS game_categories (
            url_hash INTEGER NOT NULL REFERENCES games(url_hash) ON DELETE CASCADE,
            category TEXT NOT NULL,
            position INTEGER NOT NULL,
            PRIMARY KEY (url_hash, category)
        );

        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_game_categories_category 
        ON game_categories(category, position);

        CREATE INDEX IF NOT EXISTS idx_games_is_scraped
        ON games(is_scraped);
        "#,
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_url_deterministic() {
        let url = "https://fitgirl-repacks.site/test-game/";
        let hash1 = hash_url(url);
        let hash2 = hash_url(url);
        assert_eq!(hash1, hash2);
    }
}
