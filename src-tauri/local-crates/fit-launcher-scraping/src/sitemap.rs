//! Sitemap downloading and parsing.
//!
//! Downloads sitemaps from FitGirl Repacks and stores game URLs in the database.

use regex::Regex;
use reqwest::Client;
use scraper::{Html, Selector};
use tauri::AppHandle;
use tracing::{info, warn};

use crate::db::{self, SearchIndexEntry};
use crate::errors::ScrapingError;

const BASE_URL: &str = "https://fitgirl-repacks.site/sitemap_index.xml";
const MAX_CONCURRENT: usize = 4;

/// Download all sitemaps and store URLs in the database.
pub async fn download_all_sitemaps(app: &AppHandle) -> Result<(), ScrapingError> {
    let client = Client::new();
    let sitemap_index = client.get(BASE_URL).send().await?.text().await?;

    let re = Regex::new(r"https://fitgirl-repacks\.site/post-sitemap(?:\d*)\.xml")?;
    let mut urls: Vec<String> = re
        .find_iter(&sitemap_index)
        .map(|m| m.as_str().to_string())
        .collect();

    urls.sort();
    urls.dedup();

    if urls.is_empty() {
        warn!("No post-sitemap entries found in sitemap_index.xml");
        return Ok(());
    }

    info!("Found {} sitemap files to process", urls.len());

    // Open database connection
    let conn = db::open_connection(app)?;

    // Check how many URLs we already have
    let existing_count = db::get_sitemap_url_count(&conn)?;
    info!("Database has {} existing sitemap URLs", existing_count);

    // Process sitemaps concurrently
    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT));
    let mut tasks = Vec::new();

    for sitemap_url in urls {
        let client = client.clone();
        let permit = sem.clone().acquire_owned().await?;
        let app_clone = app.clone();

        tasks.push(tokio::task::spawn(async move {
            let _permit = permit;
            match download_and_parse_sitemap(&client, &sitemap_url).await {
                Ok(entries) => {
                    let source = extract_filename(&sitemap_url);
                    let count = entries.len();

                    // Store in database
                    if let Ok(conn) = db::open_connection(&app_clone) {
                        if let Err(e) =
                            db::batch_insert_sitemap_urls(&conn, &entries, Some(&source))
                        {
                            warn!("Failed to insert URLs from {}: {}", source, e);
                        } else {
                            info!("Stored {} URLs from {}", count, source);
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to process {}: {}", sitemap_url, e);
                }
            }
        }));
    }

    futures::future::join_all(tasks).await;

    // Log final count
    let final_count = db::get_sitemap_url_count(&conn)?;
    info!(
        "Sitemap download complete. Total URLs in database: {}",
        final_count
    );

    Ok(())
}

/// Download and parse a sitemap XML file, returning extracted game URLs.
async fn download_and_parse_sitemap(
    client: &Client,
    url: &str,
) -> Result<Vec<SearchIndexEntry>, ScrapingError> {
    let content = client.get(url).send().await?.text().await?;
    parse_sitemap_content(&content)
}

/// Parse sitemap XML content and extract game URLs.
fn parse_sitemap_content(content: &str) -> Result<Vec<SearchIndexEntry>, ScrapingError> {
    let doc = Html::parse_document(content);

    let url_selector =
        Selector::parse("url").map_err(|e| ScrapingError::SelectorError(format!("{:?}", e)))?;
    let loc_selector =
        Selector::parse("loc").map_err(|e| ScrapingError::SelectorError(format!("{:?}", e)))?;

    let mut entries = Vec::new();

    for url_node in doc.select(&url_selector) {
        if let Some(loc_node) = url_node.select(&loc_selector).next() {
            let url_text = loc_node.text().collect::<String>().trim().to_string();
            if !url_text.is_empty() {
                if let Some((slug, title)) = extract_slug_and_title(&url_text) {
                    entries.push(SearchIndexEntry {
                        slug,
                        title,
                        href: url_text,
                    });
                }
            }
        }
    }

    Ok(entries)
}

fn extract_filename(url: &str) -> String {
    url.split('/')
        .next_back()
        .unwrap_or("unknown.xml")
        .to_string()
}

/// Extract slug and title from a game URL.
pub fn extract_slug_and_title(url: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = url.split('/').collect();

    if parts.len() >= 4 {
        let slug = parts[3].to_string();
        if slug.is_empty() {
            return None;
        }

        let title = slug
            .replace('-', " ")
            .split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                }
            })
            .collect::<Vec<String>>()
            .join(" ");

        return Some((slug, title));
    }
    None
}

/// Build search index from sitemap URLs stored in the database.
pub async fn build_search_index(app: &AppHandle) -> Result<(), ScrapingError> {
    let start = std::time::Instant::now();
    let app_clone = app.clone();

    tokio::task::spawn_blocking(move || -> Result<(), ScrapingError> {
        let conn = db::open_connection(&app_clone)?;

        // Get all sitemap URLs from database
        let entries = db::get_all_sitemap_urls(&conn)?;

        if entries.is_empty() {
            return Err(ScrapingError::GeneralError(
                "No sitemap URLs in database. Run sitemap download first.".into(),
            ));
        }

        info!("Building search index from {} URLs", entries.len());

        // Initialize FTS and insert entries
        db::initialize_fts(&conn)?;
        db::insert_fts_entries(&conn, &entries)?;

        info!("Search index built in {:?}", start.elapsed());
        Ok(())
    })
    .await
    .map_err(|e| ScrapingError::IOError(e.to_string()))??;

    Ok(())
}
