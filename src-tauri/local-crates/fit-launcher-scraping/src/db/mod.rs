//! Database module for game data storage.
//!
//! Uses SQLite with FTS5 for full-text search. Located at `{app_data_dir}/sitemaps/search.db`.

mod games;
mod search;

use rusqlite::{Connection, OptionalExtension, params};
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};
use tracing::info;

use crate::errors::ScrapingError;

pub use games::{
    cleanup_expired_games, get_game_by_hash, get_games_by_category, is_game_cache_valid,
    set_category_games, upsert_game,
};
pub use search::{SearchIndexEntry, initialize_fts, insert_fts_entries, query_fts};

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
pub fn hash_url(url: &str) -> String {
    let hasher = ahash::RandomState::with_seeds(0x1A, 0x6B, 0x4D, 0xF6);
    let hash = hasher.hash_one(url);
    format!("{hash:016x}")
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
    static SCHEMA_CHECKED: OnceLock<()> = OnceLock::new();

    create_tables(conn)?;

    // Recreate if schema mismatch (e.g. after app update with new columns)
    SCHEMA_CHECKED.get_or_init(|| {
        let schema_ok = conn
            .query_row(
                "SELECT url_hash, href, title, img, details, features, description, \
                 magnetlink, tag, secondary_images, created_at, updated_at \
                 FROM games LIMIT 0",
                [],
                |_| Ok(()),
            )
            .is_ok();

        if !schema_ok {
            info!("Database schema mismatch, recreating tables...");
            let _ = conn.execute_batch(
                "DROP TABLE IF EXISTS game_categories;
                 DROP TABLE IF EXISTS games;",
            );
            let _ = create_tables(conn);
        }
    });

    Ok(())
}

fn create_tables(conn: &Connection) -> Result<(), ScrapingError> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS games (
            url_hash TEXT PRIMARY KEY,
            href TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            img TEXT,
            details TEXT,
            features TEXT,
            description TEXT,
            magnetlink TEXT,
            tag TEXT,
            secondary_images TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS game_categories (
            url_hash TEXT NOT NULL REFERENCES games(url_hash) ON DELETE CASCADE,
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
        assert_eq!(hash1.len(), 16);
    }
}
