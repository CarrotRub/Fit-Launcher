//! Game CRUD and category operations.

use rusqlite::{Connection, OptionalExtension, params};
use std::fmt::Display;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::errors::ScrapingError;
use crate::structs::Game;

fn now_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn parse_secondary_images(json: Option<String>) -> Vec<String> {
    json.and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn serialize_secondary_images(images: &[String]) -> Option<String> {
    if images.is_empty() {
        None
    } else {
        Some(serde_json::to_string(images).unwrap_or_default())
    }
}

pub fn extract_slug(url: &str) -> String {
    url.split('/')
        .filter(|s| !s.is_empty())
        .nth(2)
        .unwrap_or("")
        .to_string()
}

pub struct GameMeta {
    pub url_hash: i64,
    pub title: Vec<char>,
}

pub fn list_all_games(conn: &Connection) -> Result<Vec<GameMeta>, ScrapingError> {
    let mut stmt = conn.prepare_cached("SELECT `url_hash`, `title` FROM `games`")?;
    Ok(stmt
        .query_map((), |row| {
            let url_hash = row.get(0)?;
            let title = row.get::<_, String>(1)?;
            let title = title.split_once(" - ").map(|p| p.0).unwrap_or(&title);
            let title = title.split_once(" – ").map(|p| p.0).unwrap_or(title);
            let title = title.split_once(", v").map(|p| p.0).unwrap_or(title);
            let title = title.chars().collect();
            Ok(GameMeta { url_hash, title })
        })?
        .flatten()
        .collect())
}

/// Insert a minimal game entry from sitemap (is_scraped = 0).
pub fn insert_sitemap_stub(
    conn: &Connection,
    url_hash: i64,
    href: &str,
    slug: &str,
    title: &str,
    source_sitemap: Option<&str>,
) -> Result<(), ScrapingError> {
    let now = now_timestamp();
    conn.execute(
        r#"
        INSERT INTO games (url_hash, href, slug, title, is_scraped, source_sitemap, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?6)
        ON CONFLICT(url_hash) DO NOTHING
        "#,
        params![url_hash, href, slug, title, source_sitemap, now],
    )?;
    Ok(())
}

pub fn batch_insert_sitemap_stubs(
    conn: &Connection,
    entries: &[(i64, String, String, String)],
    source_sitemap: Option<&str>,
) -> Result<usize, ScrapingError> {
    let tx = conn.unchecked_transaction()?;
    let now = now_timestamp();
    let mut inserted_count = 0;

    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO games (url_hash, href, slug, title, is_scraped, source_sitemap, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?6)",
        )?;

        for (url_hash, href, slug, title) in entries {
            stmt.execute(params![url_hash, href, slug, title, source_sitemap, now])?;
            // changes() returns 1 if row was inserted, 0 if ignored (duplicate)
            inserted_count += tx.changes() as usize;
        }
    }

    tx.commit()?;
    Ok(inserted_count)
}

pub fn upsert_game(conn: &Connection, url_hash: i64, game: &Game) -> Result<(), ScrapingError> {
    let now = now_timestamp();
    let secondary_json = serialize_secondary_images(&game.secondary_images);
    let slug = extract_slug(&game.href);

    conn.execute(
        r#"
        INSERT INTO games (url_hash, href, slug, title, img, details, features, description, gameplay_features, included_dlcs,
                          pastebin_link, magnetlink, tag, secondary_images, is_scraped, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 1, ?15, ?15)
        ON CONFLICT(url_hash) DO UPDATE SET
            title = excluded.title,
            img = excluded.img,
            details = excluded.details,
            features = excluded.features,
            description = excluded.description,
            gameplay_features = excluded.gameplay_features,
            included_dlcs = excluded.included_dlcs,
            pastebin_link = excluded.pastebin_link,
            magnetlink = excluded.magnetlink,
            tag = excluded.tag,
            secondary_images = excluded.secondary_images,
            is_scraped = 1,
            updated_at = excluded.updated_at
        "#,
        params![
            url_hash,
            &game.href,
            &slug,
            &game.title,
            &game.img,
            &game.details,
            &game.features,
            &game.description,
            &game.gameplay_features,
            &game.included_dlcs,
            &game.pastebin_link,
            &game.magnetlink,
            &game.tag,
            &secondary_json,
            now,
        ],
    )?;

    Ok(())
}

pub fn get_game_by_hash(conn: &Connection, url_hash: i64) -> Result<Option<Game>, ScrapingError> {
    let mut stmt = conn.prepare(
        "SELECT href, title, img, details, features, description, gameplay_features, included_dlcs, pastebin_link, magnetlink, tag, secondary_images 
         FROM games WHERE url_hash = ?1 AND is_scraped = 1",
    )?;

    let result = stmt
        .query_row(params![url_hash], |row| {
            Ok(Game {
                href: row.get(0)?,
                title: row.get(1)?,
                img: row.get(2)?,
                details: row.get(3)?,
                features: row.get(4)?,
                description: row.get(5)?,
                gameplay_features: row.get(6)?,
                included_dlcs: row.get(7)?,
                pastebin_link: row.get(8)?,
                magnetlink: row.get(9)?,
                tag: row.get(10)?,
                secondary_images: parse_secondary_images(row.get(11)?),
            })
        })
        .optional()?;

    Ok(result)
}

pub fn is_game_cache_valid(
    conn: &Connection,
    url_hash: i64,
    expiry_secs: i64,
) -> Result<bool, ScrapingError> {
    let cutoff = now_timestamp() - expiry_secs;
    let mut stmt = conn.prepare(
        "SELECT 1 FROM games WHERE url_hash = ?1 AND is_scraped = 1 AND updated_at > ?2",
    )?;
    Ok(stmt.exists(params![url_hash, cutoff])?)
}

pub fn cleanup_expired_games(conn: &Connection, expiry_secs: i64) -> Result<usize, ScrapingError> {
    let cutoff = now_timestamp() - expiry_secs;
    let deleted = conn.execute(
        "DELETE FROM games WHERE is_scraped = 1 AND updated_at < ?1 
         AND url_hash NOT IN (SELECT url_hash FROM game_categories)",
        params![cutoff],
    )?;
    Ok(deleted)
}

/// Clears scraped game data but preserves sitemap stubs.
/// Resets is_scraped to 0 and clears detail fields, keeping slug/title/href for search.
pub fn clear_game_cache(conn: &Connection) -> Result<(), ScrapingError> {
    conn.execute_batch(
        "-- Clear category associations
         DELETE FROM game_categories;
         
         -- Reset scraped data but keep stubs for search
         UPDATE games SET
             img = NULL,
             details = NULL,
             features = NULL,
             description = NULL,
             pastebin_link = NULL,
             magnetlink = NULL,
             tag = NULL,
             secondary_images = NULL,
             is_scraped = 0
         WHERE is_scraped = 1;
         
         -- Clear category metadata
         DELETE FROM metadata WHERE key LIKE 'category_%_updated';

         -- Clear last discovery update time
         DELETE FROM metadata WHERE key = 'discovery_last_refresh';
         ",
    )?;
    Ok(())
}

/// Use this for a full reset (will require re-downloading sitemaps).
pub fn clear_all_game_data(conn: &Connection) -> Result<(), ScrapingError> {
    conn.execute_batch(
        "
    -- Remove all stub from sitemaps
    DELETE FROM games;
    ",
    )?;
    clear_game_cache(conn)?;
    Ok(())
}

pub fn get_game_count(conn: &Connection) -> Result<usize, ScrapingError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM games", [], |row| row.get(0))?;
    Ok(count as usize)
}

pub fn get_pastebin_by_magnet_hash(
    conn: &Connection,
    hash: impl Display,
) -> Result<Option<String>, ScrapingError> {
    Ok(conn.query_one(
        r#"
    SELECT `pastebin_link` FROM `games`
    WHERE `is_scraped` = 1
    AND `magnetlink` LIKE ?
    COLLATE NOCASE;
        "#,
        [&format!("%{hash}%")],
        |row| row.get(0).optional(),
    )?)
}

pub fn get_games_by_category(
    conn: &Connection,
    category: &str,
) -> Result<Vec<Game>, ScrapingError> {
    let mut stmt = conn.prepare(
        r#"
        SELECT g.href, g.title, g.img, g.details, g.features, g.description, g.gameplay_features, g.included_dlcs,
               g.pastebin_link, g.magnetlink, g.tag, g.secondary_images
        FROM games g
        INNER JOIN game_categories gc ON g.url_hash = gc.url_hash
        WHERE gc.category = ?1
        ORDER BY gc.position
        "#,
    )?;

    let games = stmt
        .query_map(params![category], |row| {
            Ok(Game {
                href: row.get(0)?,
                title: row.get(1)?,
                img: row.get(2)?,
                details: row.get(3)?,
                features: row.get(4)?,
                description: row.get(5)?,
                gameplay_features: row.get(6)?,
                included_dlcs: row.get(7)?,
                pastebin_link: row.get(8)?,
                magnetlink: row.get(9)?,
                tag: row.get(10)?,
                secondary_images: parse_secondary_images(row.get(11)?),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(games)
}

pub fn set_category_games(
    conn: &Connection,
    category: &str,
    games: &[Game],
    hash_fn: impl Fn(&str) -> i64,
) -> Result<(), ScrapingError> {
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "DELETE FROM game_categories WHERE category = ?1",
        params![category],
    )?;

    for (position, game) in games.iter().enumerate() {
        let url_hash = hash_fn(&game.href);
        let now = now_timestamp();
        let secondary_json = serialize_secondary_images(&game.secondary_images);
        let slug = extract_slug(&game.href);

        tx.execute(
            r#"
            INSERT INTO games (url_hash, href, slug, title, img, details, features, description, gameplay_features, included_dlcs,
                              pastebin_link, magnetlink, tag, secondary_images, is_scraped, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 1, ?15, ?15)
            ON CONFLICT(url_hash) DO UPDATE SET
                title = excluded.title,
                img = excluded.img,
                details = excluded.details,
                features = excluded.features,
                description = excluded.description,
                gameplay_features = excluded.gameplay_features,
                included_dlcs = excluded.included_dlcs,
                pastebin_link = excluded.pastebin_link,
                magnetlink = excluded.magnetlink,
                tag = excluded.tag,
                secondary_images = excluded.secondary_images,
                is_scraped = 1,
                updated_at = excluded.updated_at
            "#,
            params![
                &url_hash,
                &game.href,
                &slug,
                &game.title,
                &game.img,
                &game.details,
                &game.features,
                &game.description,
                &game.gameplay_features,
                &game.included_dlcs,
                &game.pastebin_link,
                &game.magnetlink,
                &game.tag,
                &secondary_json,
                now,
            ],
        )?;

        tx.execute(
            "
            INSERT INTO game_categories (url_hash, category, position) VALUES (?1, ?2, ?3)
            ON CONFLICT (url_hash, category) DO NOTHING",
            params![&url_hash, category, position as i64],
        )?;
    }

    tx.commit()?;
    Ok(())
}
