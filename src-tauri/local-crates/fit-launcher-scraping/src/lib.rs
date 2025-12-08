//! FitGirl Repacks scraping library.
//!
//! Provides game data scraping, caching, and search functionality.

pub mod captcha;
pub mod commands;
pub mod db;
pub mod discovery;
pub mod errors;
pub mod parser;
pub mod scraping;
pub mod sitemap;
pub mod structs;

// Re-export commands for Tauri registration
pub use commands::*;

// Re-export commonly used types
pub use db::{SearchIndexEntry, hash_url};
pub use errors::ScrapingError;
pub use structs::Game;
