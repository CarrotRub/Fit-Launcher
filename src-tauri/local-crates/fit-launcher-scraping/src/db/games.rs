//! Game CRUD and category operations.

use rusqlite::{Connection, OptionalExtension, params};
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

pub fn upsert_game(conn: &Connection, url_hash: &str, game: &Game) -> Result<(), ScrapingError> {
    let now = now_timestamp();
    let secondary_json = serialize_secondary_images(&game.secondary_images);

    conn.execute(
        r#"
        INSERT INTO games (url_hash, href, title, img, details, features, description, 
                          magnetlink, tag, secondary_images, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
        ON CONFLICT(url_hash) DO UPDATE SET
            title = excluded.title,
            img = excluded.img,
            details = excluded.details,
            features = excluded.features,
            description = excluded.description,
            magnetlink = excluded.magnetlink,
            tag = excluded.tag,
            secondary_images = excluded.secondary_images,
            updated_at = excluded.updated_at
        "#,
        params![
            url_hash,
            &game.href,
            &game.title,
            &game.img,
            &game.details,
            &game.features,
            &game.description,
            &game.magnetlink,
            &game.tag,
            &secondary_json,
            now,
        ],
    )?;

    Ok(())
}

pub fn get_game_by_hash(conn: &Connection, url_hash: &str) -> Result<Option<Game>, ScrapingError> {
    let mut stmt = conn.prepare(
        "SELECT href, title, img, details, features, description, magnetlink, tag, secondary_images 
         FROM games WHERE url_hash = ?1",
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
                magnetlink: row.get(6)?,
                tag: row.get(7)?,
                secondary_images: parse_secondary_images(row.get(8)?),
            })
        })
        .optional()?;

    Ok(result)
}

pub fn is_game_cache_valid(
    conn: &Connection,
    url_hash: &str,
    expiry_secs: i64,
) -> Result<bool, ScrapingError> {
    let cutoff = now_timestamp() - expiry_secs;
    let mut stmt = conn.prepare("SELECT 1 FROM games WHERE url_hash = ?1 AND updated_at > ?2")?;
    Ok(stmt.exists(params![url_hash, cutoff])?)
}

/// Deletes orphan cache entries older than expiry_secs.
/// Games in categories are preserved since they're actively displayed.
pub fn cleanup_expired_games(conn: &Connection, expiry_secs: i64) -> Result<usize, ScrapingError> {
    let cutoff = now_timestamp() - expiry_secs;
    let deleted = conn.execute(
        "DELETE FROM games WHERE updated_at < ?1 AND url_hash NOT IN (SELECT url_hash FROM game_categories)",
        params![cutoff],
    )?;
    Ok(deleted)
}

pub fn get_games_by_category(
    conn: &Connection,
    category: &str,
) -> Result<Vec<Game>, ScrapingError> {
    let mut stmt = conn.prepare(
        r#"
        SELECT g.href, g.title, g.img, g.details, g.features, g.description, 
               g.magnetlink, g.tag, g.secondary_images
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
                magnetlink: row.get(6)?,
                tag: row.get(7)?,
                secondary_images: parse_secondary_images(row.get(8)?),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(games)
}

pub fn set_category_games(
    conn: &Connection,
    category: &str,
    games: &[Game],
    hash_fn: impl Fn(&str) -> String,
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

        tx.execute(
            r#"
            INSERT INTO games (url_hash, href, title, img, details, features, description, 
                              magnetlink, tag, secondary_images, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
            ON CONFLICT(url_hash) DO UPDATE SET
                title = excluded.title,
                img = excluded.img,
                details = excluded.details,
                features = excluded.features,
                description = excluded.description,
                magnetlink = excluded.magnetlink,
                tag = excluded.tag,
                secondary_images = excluded.secondary_images,
                updated_at = excluded.updated_at
            "#,
            params![
                &url_hash,
                &game.href,
                &game.title,
                &game.img,
                &game.details,
                &game.features,
                &game.description,
                &game.magnetlink,
                &game.tag,
                &secondary_json,
                now,
            ],
        )?;

        tx.execute(
            "INSERT INTO game_categories (url_hash, category, position) VALUES (?1, ?2, ?3)",
            params![&url_hash, category, position as i64],
        )?;
    }

    tx.commit()?;
    Ok(())
}
