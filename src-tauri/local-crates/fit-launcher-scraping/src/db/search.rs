//! Full-text search implementation using SQLite FTS5.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::errors::ScrapingError;

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct SearchIndexEntry {
    pub slug: String,
    pub title: String,
    pub href: String,
}

/// Start fresh with a new FTS5 table.
/// We use 'porter unicode61' to handle stemming ("games" matches "game") and unicode characters.
pub fn initialize_fts(conn: &Connection) -> Result<(), ScrapingError> {
    conn.execute_batch(
        r#"
        DROP TABLE IF EXISTS games_fts;
        CREATE VIRTUAL TABLE games_fts USING fts5(
            slug,
            title,
            href,
            tokenize = 'porter unicode61'
        );
        "#,
    )?;
    Ok(())
}

pub fn insert_fts_entries(
    conn: &Connection,
    entries: &[SearchIndexEntry],
) -> Result<(), ScrapingError> {
    let tx = conn.unchecked_transaction()?;

    {
        let mut stmt =
            tx.prepare("INSERT INTO games_fts (slug, title, href) VALUES (?1, ?2, ?3)")?;

        for entry in entries {
            stmt.execute(params![&entry.slug, &entry.title, &entry.href])?;
        }
    }

    tx.commit()?;
    Ok(())
}

/// Query the FTS index using BM25 ranking.
/// Appends `*` to the query for prefix matching.
pub fn query_fts(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchIndexEntry>, ScrapingError> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let escaped = escape_fts5_query(query);
    let fts_query = format!("{}*", escaped);

    let mut stmt = conn.prepare(
        "SELECT slug, title, href FROM games_fts 
         WHERE games_fts MATCH ?1 
         ORDER BY rank 
         LIMIT ?2",
    )?;

    let results = stmt
        .query_map(params![&fts_query, limit as i64], |row| {
            Ok(SearchIndexEntry {
                slug: row.get(0)?,
                title: row.get(1)?,
                href: row.get(2)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

/// Double quotes to escape them in FTS5 syntax.
fn escape_fts5_query(query: &str) -> String {
    query
        .replace('"', "\"\"")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

// ============================================================================
// Sitemap URL Storage
// ============================================================================

fn now_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// Insert or update a sitemap URL entry.
pub fn upsert_sitemap_url(
    conn: &Connection,
    href: &str,
    slug: &str,
    title: &str,
    source_file: Option<&str>,
) -> Result<(), ScrapingError> {
    let now = now_timestamp();
    conn.execute(
        "INSERT INTO sitemap_urls (href, slug, title, source_file, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(href) DO UPDATE SET
             slug = excluded.slug,
             title = excluded.title,
             source_file = excluded.source_file",
        params![href, slug, title, source_file, now],
    )?;
    Ok(())
}

/// Batch insert sitemap URLs (faster than individual inserts).
pub fn batch_insert_sitemap_urls(
    conn: &Connection,
    entries: &[SearchIndexEntry],
    source_file: Option<&str>,
) -> Result<usize, ScrapingError> {
    let tx = conn.unchecked_transaction()?;
    let now = now_timestamp();
    let mut count = 0;

    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO sitemap_urls (href, slug, title, source_file, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;

        for entry in entries {
            stmt.execute(params![
                &entry.href,
                &entry.slug,
                &entry.title,
                source_file,
                now
            ])?;
            count += 1;
        }
    }

    tx.commit()?;
    Ok(count)
}

/// Get all sitemap URLs as search index entries.
pub fn get_all_sitemap_urls(conn: &Connection) -> Result<Vec<SearchIndexEntry>, ScrapingError> {
    let mut stmt = conn.prepare("SELECT slug, title, href FROM sitemap_urls ORDER BY title")?;

    let entries = stmt
        .query_map([], |row| {
            Ok(SearchIndexEntry {
                slug: row.get(0)?,
                title: row.get(1)?,
                href: row.get(2)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

/// Get count of sitemap URLs.
pub fn get_sitemap_url_count(conn: &Connection) -> Result<usize, ScrapingError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM sitemap_urls", [], |row| row.get(0))?;
    Ok(count as usize)
}

/// Clear all sitemap URLs.
pub fn clear_sitemap_urls(conn: &Connection) -> Result<(), ScrapingError> {
    conn.execute("DELETE FROM sitemap_urls", [])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_fts5_query() {
        assert_eq!(escape_fts5_query("dragon ball"), "dragon ball");
        assert_eq!(
            escape_fts5_query("dragon \"quotes\" ball"),
            "dragon \"\"quotes\"\" ball"
        );
    }
}
