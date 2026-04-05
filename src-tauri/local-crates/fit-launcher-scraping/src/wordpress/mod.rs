use futures::StreamExt;
use std::collections::HashSet;
use std::time::Instant;
use tauri::AppHandle;
use tracing::{info, warn};

use crate::db;
use crate::errors::ScrapingError;
use crate::structs::Game;
use crate::wordpress::parser::parse_game_from_wp;
use crate::wordpress::rest::endpoint::{Endpoint, EnpointWpLosslessRepack};
use crate::wordpress::rest::models::WpPost;
use crate::wordpress::rest::query::QueryWpLosslessRepack;

const RECENT_GAMES_CATEGORY: &str = "newly_added";
const RECENT_GAMES_METADATA_KEY: &str = "category_newly_added_updated";
// 4 hours
const RECENT_GAMES_MAX_AGE_SECS: i64 = 240 * 60;

const DISCOVERY_GAMES_CATEGORY: &str = "discovery";
const DISCOVERY_GAMES_METADATA_KEY: &str = "category_discovery_updated";
// 4 hours
const DISCOVERY_GAMES_MAX_AGE_SECS: i64 = 240 * 60;

pub mod parser;
pub mod rest;

pub async fn get_game_list_wp(game_number: u8) -> Result<Vec<Game>, ScrapingError> {
    let endpoint = Endpoint::<EnpointWpLosslessRepack>::new();

    let posts: Vec<WpPost> = endpoint
        .call_query(&QueryWpLosslessRepack {
            per_page: game_number,
            page: None,
        })
        .await?;

    let games: Vec<Game> = futures::stream::iter(posts.into_iter())
        .map(|post| async move { parse_game_from_wp(post) })
        .buffer_unordered(10)
        .filter_map(async move |opt| opt)
        .collect()
        .await;
    Ok(games)
}

pub struct WpGameFetcher {
    pub recent_games: Vec<Game>,
    pub discovery_games: Vec<Game>,
}

impl WpGameFetcher {
    pub fn new() -> Self {
        Self {
            recent_games: Vec::new(),
            discovery_games: Vec::new(),
        }
    }

    async fn fetch_games_paginated(per_page: u8, pages: u8) -> Result<Vec<Game>, ScrapingError> {
        let endpoint = Endpoint::<EnpointWpLosslessRepack>::new();
        let mut all_games = Vec::new();

        for page in 1..=pages {
            let posts: Vec<WpPost> = endpoint
                .call_query(&QueryWpLosslessRepack {
                    per_page,
                    page: Some(page),
                })
                .await?;

            if posts.is_empty() {
                break;
            }

            let games: Vec<Game> = futures::stream::iter(posts.into_iter())
                .map(|post| async move { parse_game_from_wp(post) })
                .buffer_unordered(10)
                .filter_map(async move |opt| opt)
                .collect()
                .await;

            all_games.extend(games);
        }

        Ok(all_games)
    }

    pub async fn fetch_recent_games(&mut self, game_number: u8) -> Result<(), ScrapingError> {
        let endpoint = Endpoint::<EnpointWpLosslessRepack>::new();
        let posts: Vec<WpPost> = endpoint
            .call_query(&QueryWpLosslessRepack {
                per_page: game_number,
                page: None,
            })
            .await?;

        self.recent_games = futures::stream::iter(posts.into_iter())
            .map(|post| async move { parse_game_from_wp(post) })
            .buffer_unordered(10)
            .filter_map(async move |opt| opt)
            .collect()
            .await;

        Ok(())
    }

    pub async fn fetch_discovery_games(&mut self) -> Result<(), ScrapingError> {
        // WP REST API caps per_page at 99, fetch 2 pages to get ~198
        self.discovery_games = Self::fetch_games_paginated(99, 2).await?;

        Ok(())
    }

    fn write_games_to_db_with_key(
        app: &AppHandle,
        games: &[Game],
        category: &str,
        metadata_key: &str,
    ) -> Result<(), ScrapingError> {
        let conn = db::open_connection(app)?;
        db::set_category_games(&conn, category, games, db::hash_url)?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string();
        db::set_metadata(&conn, metadata_key, &now)?;

        info!("Wrote {} games to DB under '{}'", games.len(), category);
        Ok(())
    }

    fn write_recent_games_to_db(app: &AppHandle, games: &[Game]) -> Result<(), ScrapingError> {
        Self::write_games_to_db_with_key(
            app,
            games,
            RECENT_GAMES_CATEGORY,
            RECENT_GAMES_METADATA_KEY,
        )
    }

    fn write_discovery_games_to_db(app: &AppHandle, games: &[Game]) -> Result<(), ScrapingError> {
        Self::write_games_to_db_with_key(
            app,
            games,
            DISCOVERY_GAMES_CATEGORY,
            DISCOVERY_GAMES_METADATA_KEY,
        )
    }

    fn cache_age_secs(app: &AppHandle, metadata_key: &str) -> Result<Option<i64>, ScrapingError> {
        let conn = db::open_connection(app)?;
        match db::get_metadata(&conn, metadata_key)? {
            None => Ok(None),
            Some(ts_str) => {
                let last_ts: i64 = ts_str.parse().unwrap_or(0);
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
                Ok(Some(now - last_ts))
            }
        }
    }

    pub fn recent_games_age_secs(app: &AppHandle) -> Result<Option<i64>, ScrapingError> {
        Self::cache_age_secs(app, RECENT_GAMES_METADATA_KEY)
    }

    pub fn discovery_games_age_secs(app: &AppHandle) -> Result<Option<i64>, ScrapingError> {
        Self::cache_age_secs(app, DISCOVERY_GAMES_METADATA_KEY)
    }

    pub fn is_recent_games_fresh(app: &AppHandle) -> Result<bool, ScrapingError> {
        Ok(Self::recent_games_age_secs(app)?.map_or(false, |age| age < RECENT_GAMES_MAX_AGE_SECS))
    }

    pub fn is_discovery_games_fresh(app: &AppHandle) -> Result<bool, ScrapingError> {
        Ok(Self::discovery_games_age_secs(app)?
            .map_or(false, |age| age < DISCOVERY_GAMES_MAX_AGE_SECS))
    }

    pub fn load_recent_games_from_db(&mut self, app: &AppHandle) -> Result<(), ScrapingError> {
        let conn = db::open_connection(app)?;
        self.recent_games =
            db::get_games_by_category(&conn, RECENT_GAMES_CATEGORY).unwrap_or_default();
        Ok(())
    }

    pub fn load_discovery_games_from_db(&mut self, app: &AppHandle) -> Result<(), ScrapingError> {
        let conn = db::open_connection(app)?;
        self.discovery_games =
            db::get_games_by_category(&conn, DISCOVERY_GAMES_CATEGORY).unwrap_or_default();
        Ok(())
    }

    /// Full sync: fetch from WP API, diff against DB, write if changed.
    pub async fn sync_recent_games(
        &mut self,
        app: &AppHandle,
        game_number: u8,
    ) -> Result<(), ScrapingError> {
        let start = Instant::now();

        self.fetch_recent_games(game_number).await?;

        if self.recent_games.is_empty() {
            warn!("No recent games returned from WordPress API");
            return Ok(());
        }

        let conn = db::open_connection(app)?;
        let existing = db::get_games_by_category(&conn, RECENT_GAMES_CATEGORY).unwrap_or_default();

        let current_urls: HashSet<_> = self.recent_games.iter().map(|g| g.href.clone()).collect();
        let existing_urls: HashSet<_> = existing.iter().map(|g| g.href.clone()).collect();

        if current_urls == existing_urls && existing.len() == self.recent_games.len() {
            info!(
                "Recent games already in sync ({} games), skipping write",
                existing.len()
            );
            return Ok(());
        }

        info!(
            "Syncing recent games: {} from API, {} in DB",
            self.recent_games.len(),
            existing.len()
        );

        Self::write_recent_games_to_db(app, &self.recent_games)?;
        info!("Recent games synced in {:?}", start.elapsed());
        Ok(())
    }

    pub async fn sync_discovery_games(&mut self, app: &AppHandle) -> Result<(), ScrapingError> {
        let start = Instant::now();

        self.fetch_discovery_games().await?;

        if self.discovery_games.is_empty() {
            warn!("No discovery games returned from WordPress API");
            return Ok(());
        }

        let conn = db::open_connection(app)?;
        let existing =
            db::get_games_by_category(&conn, DISCOVERY_GAMES_CATEGORY).unwrap_or_default();

        let current_urls: HashSet<_> = self
            .discovery_games
            .iter()
            .map(|g| g.href.clone())
            .collect();
        let existing_urls: HashSet<_> = existing.iter().map(|g| g.href.clone()).collect();

        if current_urls == existing_urls && existing.len() == self.discovery_games.len() {
            info!(
                "Discovery games already in sync ({} games), skipping write",
                existing.len()
            );
            return Ok(());
        }

        info!(
            "Syncing discovery games: {} from API, {} in DB",
            self.discovery_games.len(),
            existing.len()
        );

        Self::write_discovery_games_to_db(app, &self.discovery_games)?;
        info!("Discovery games synced in {:?}", start.elapsed());
        Ok(())
    }

    pub async fn refresh_recent_games(
        &mut self,
        app: &AppHandle,
        game_number: u8,
    ) -> Result<(), ScrapingError> {
        info!("Force refreshing recent games");
        self.sync_recent_games(app, game_number).await
    }

    pub async fn refresh_discovery_games(&mut self, app: &AppHandle) -> Result<(), ScrapingError> {
        info!("Force refreshing discovery games");
        self.sync_discovery_games(app).await
    }

    pub async fn get_or_refresh_recent_games(
        &mut self,
        app: &AppHandle,
        game_number: u8,
    ) -> Result<(), ScrapingError> {
        if Self::is_recent_games_fresh(app)? {
            info!("Recent games cache is fresh, loading from DB");
            self.load_recent_games_from_db(app)?;
        } else {
            info!("Recent games cache is stale, refreshing from API");
            self.sync_recent_games(app, game_number).await?;
        }
        Ok(())
    }

    pub async fn get_or_refresh_discovery_games(
        &mut self,
        app: &AppHandle,
    ) -> Result<(), ScrapingError> {
        if Self::is_discovery_games_fresh(app)? {
            info!("Discovery games cache is fresh, loading from DB");
            self.load_discovery_games_from_db(app)?;
        } else {
            info!("Discovery games cache is stale, refreshing from API");
            self.sync_discovery_games(app).await?;
        }
        Ok(())
    }
}

impl Default for WpGameFetcher {
    fn default() -> Self {
        Self::new()
    }
}
