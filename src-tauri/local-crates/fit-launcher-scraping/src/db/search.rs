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
