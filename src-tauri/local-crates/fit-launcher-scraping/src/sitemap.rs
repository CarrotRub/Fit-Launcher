//! Sitemap downloading and parsing.

use std::path::PathBuf;

use futures::future::join_all;
use regex::Regex;
use reqwest::Client;
use tauri::{AppHandle, Manager};
use tokio::{fs, task};
use tracing::{info, warn};

use crate::db::SearchIndexEntry;
use crate::errors::ScrapingError;

const BASE_URL: &str = "https://fitgirl-repacks.site/sitemap_index.xml";
const MAX_CONCURRENT: usize = 4;

/// Download all sitemaps from the index
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

    let sitemaps_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir")
        .join("sitemaps");

    fs::create_dir_all(&sitemaps_dir).await?;

    // Check if largest sitemap exists (determines if we need full refresh)
    let max_number = urls
        .iter()
        .filter_map(|url| {
            let re_num = Regex::new(r"post-sitemap(\d*)\.xml").unwrap();
            re_num
                .captures(url)
                .and_then(|cap| cap.get(1))
                .and_then(|m| {
                    if m.as_str().is_empty() {
                        Some(1)
                    } else {
                        m.as_str().parse::<usize>().ok()
                    }
                })
        })
        .max()
        .unwrap_or(1);

    let largest_sitemap = format!("post-sitemap{}.xml", max_number);
    let largest_path = sitemaps_dir.join(&largest_sitemap);

    if !largest_path.exists() {
        warn!(
            "Largest sitemap {} missing. Clearing all sitemaps and redownloading...",
            largest_sitemap
        );

        if let Ok(mut entries) = fs::read_dir(&sitemaps_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let _ = fs::remove_file(entry.path()).await;
            }
        }
    }

    // Check which sitemaps already exist
    let check_tasks = urls.iter().map(|url| {
        let filename = extract_filename(url);
        let path = sitemaps_dir.join(&filename);
        task::spawn(async move { fs::try_exists(&path).await.unwrap_or(false) })
    });
    let existing = join_all(check_tasks).await;

    let to_download: Vec<_> = urls
        .into_iter()
        .zip(existing)
        .filter_map(|(url, exists)| match exists {
            Ok(true) => None,
            _ => Some(url),
        })
        .collect();

    if to_download.is_empty() {
        info!("All sitemap files already up to date");
        return Ok(());
    }

    info!("Downloading {} missing sitemaps", to_download.len());

    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT));
    let mut tasks = Vec::new();

    for url in to_download {
        let filename = extract_filename(&url);
        let dest_path = sitemaps_dir.join(&filename);

        let client = client.clone();
        let permit = sem.clone().acquire_owned().await?;

        tasks.push(task::spawn(async move {
            let _permit = permit;
            match download_sitemap_file(&client, &url, &dest_path).await {
                Ok(_) => info!("Downloaded {filename}"),
                Err(e) => tracing::error!("Failed {filename}: {e}"),
            }
        }));
    }

    join_all(tasks).await;
    Ok(())
}

fn extract_filename(url: &str) -> String {
    url.split('/')
        .next_back()
        .unwrap_or("unknown.xml")
        .to_string()
}

async fn download_sitemap_file(
    client: &Client,
    url: &str,
    dest_path: &PathBuf,
) -> Result<(), ScrapingError> {
    let data = client.get(url).send().await?.bytes().await?;
    fs::write(dest_path, &data).await?;
    Ok(())
}

/// Parse a sitemap XML file and extract URLs
pub async fn parse_sitemap_file(file_path: &PathBuf) -> Result<Vec<String>, ScrapingError> {
    use scraper::{Html, Selector};

    let content = fs::read_to_string(file_path).await?;
    let doc = Html::parse_document(&content);

    let url_selector =
        Selector::parse("url").map_err(|e| ScrapingError::SelectorError(format!("{:?}", e)))?;
    let loc_selector =
        Selector::parse("loc").map_err(|e| ScrapingError::SelectorError(format!("{:?}", e)))?;

    let mut urls = Vec::new();

    for url_node in doc.select(&url_selector) {
        if let Some(loc_node) = url_node.select(&loc_selector).next() {
            let url_text = loc_node.text().collect::<String>().trim().to_string();
            if !url_text.is_empty() {
                urls.push(url_text);
            }
        }
    }

    Ok(urls)
}

/// Extract slug and title from a game URL
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

/// Build search index from all sitemap files
pub async fn build_search_index(app: &AppHandle) -> Result<(), ScrapingError> {
    let start = std::time::Instant::now();

    let sitemaps_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| ScrapingError::IOError(e.to_string()))?
        .join("sitemaps");

    if !sitemaps_dir.exists() {
        return Err(ScrapingError::IOError(format!(
            "Sitemaps directory does not exist: {}",
            sitemaps_dir.display()
        )));
    }

    let mut entries = Vec::new();
    let mut seen_hrefs = std::collections::HashSet::new();

    let mut dir_entries = fs::read_dir(&sitemaps_dir).await?;

    while let Ok(Some(entry)) = dir_entries.next_entry().await {
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();

        if file_name_str.starts_with("post-sitemap") && file_name_str.ends_with(".xml") {
            let file_path = entry.path();
            info!("Parsing sitemap file: {}", file_name_str);

            match parse_sitemap_file(&file_path).await {
                Ok(urls) => {
                    for url in urls {
                        if seen_hrefs.insert(url.clone())
                            && let Some((slug, title)) = extract_slug_and_title(&url)
                        {
                            entries.push(SearchIndexEntry {
                                slug,
                                title,
                                href: url,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to parse sitemap file {}: {}", file_name_str, e);
                }
            }
        }
    }

    if entries.is_empty() {
        return Err(ScrapingError::GeneralError(
            "No valid entries found in sitemap files".into(),
        ));
    }

    entries.sort_by(|a, b| a.title.cmp(&b.title));
    info!("Built search index with {} entries", entries.len());

    // Write to SQLite
    let db_path = sitemaps_dir.join("search.db");
    let entries_clone = entries.clone();

    tokio::task::spawn_blocking(move || -> Result<(), ScrapingError> {
        let conn = rusqlite::Connection::open(&db_path)?;
        crate::db::initialize_fts(&conn)?;
        crate::db::insert_fts_entries(&conn, &entries_clone)?;
        Ok(())
    })
    .await
    .map_err(|e| ScrapingError::IOError(e.to_string()))??;

    info!("Search index written to SQLite in {:?}", start.elapsed());
    Ok(())
}
