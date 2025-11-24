use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashSet;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::io::{AsyncWriteExt, BufWriter};
use tracing::{info, warn};

use crate::errors::{CreatingFileErrorStruct, ScrapingError};

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct SearchIndexEntry {
    pub slug: String,
    pub title: String,
    pub href: String,
}

pub type SearchIndex = Vec<SearchIndexEntry>;

/// Extract slug and title from a URL
pub(crate) fn extract_slug_and_title(url: &str) -> Option<(String, String)> {
    // URLs are like: https://fitgirl-repacks.site/game-name/
    let parts: Vec<&str> = url.split('/').collect();

    // Find the game slug (usually the 4th part after https://, domain, empty)
    if parts.len() >= 4 {
        let slug = parts[3].to_string();
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

/// Parse a single sitemap XML file and extract URLs
async fn parse_sitemap_file(file_path: &PathBuf) -> Result<Vec<String>, ScrapingError> {
    use scraper::{Html, Selector};

    let content = fs::read_to_string(file_path).await.map_err(|e| {
        ScrapingError::IOError(format!(
            "Failed to read sitemap file {}: {}",
            file_path.display(),
            e
        ))
    })?;

    let doc = Html::parse_document(&content);

    let url_selector = Selector::parse("url").map_err(|e| {
        ScrapingError::SelectorError(format!("Failed to parse URL selector: {}", e))
    })?;

    let loc_selector = Selector::parse("loc").map_err(|e| {
        ScrapingError::SelectorError(format!("Failed to parse loc selector: {}", e))
    })?;

    let mut urls = Vec::new();

    // Find all <url><loc>...</loc></url> entries
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

/// Build search index from all sitemap files
pub async fn build_search_index(app_handle: &AppHandle) -> Result<(), ScrapingError> {
    let start = std::time::Instant::now();

    let sitemaps_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| ScrapingError::IOError(format!("Failed to get app data dir: {}", e)))?
        .join("sitemaps");

    if !sitemaps_dir.exists() {
        warn!(
            "Sitemaps directory does not exist: {}",
            sitemaps_dir.display()
        );
        return Err(ScrapingError::IOError(format!(
            "Sitemaps directory does not exist: {}",
            sitemaps_dir.display()
        )));
    }

    // Read all post-sitemap*.xml files
    let mut entries = Vec::new();
    let mut seen_hrefs = HashSet::new();

    let mut dir_entries = fs::read_dir(&sitemaps_dir)
        .await
        .map_err(|e| ScrapingError::IOError(format!("Failed to read sitemaps directory: {}", e)))?;

    while let Ok(Some(entry)) = dir_entries.next_entry().await {
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();

        // Only process post-sitemap*.xml files
        if file_name_str.starts_with("post-sitemap") && file_name_str.ends_with(".xml") {
            let file_path = entry.path();
            info!("Parsing sitemap file: {}", file_name_str);

            match parse_sitemap_file(&file_path).await {
                Ok(urls) => {
                    for url in urls {
                        // Deduplicate by href
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
                    // Continue with other files instead of failing completely
                }
            }
        }
    }

    if entries.is_empty() {
        warn!("No entries found in sitemap files");
        return Err(ScrapingError::GlobalError(
            "No valid entries found in sitemap files".into(),
        ));
    }

    // Sort by title for consistent ordering
    entries.sort_by(|a, b| a.title.cmp(&b.title));

    info!("Built search index with {} entries", entries.len());

    // Write index using atomic write pattern
    let final_path = sitemaps_dir.join("search-index.json");
    let tmp_path = sitemaps_dir.join("search-index.json.tmp");

    let json = serde_json::to_string_pretty(&entries).map_err(|e| {
        ScrapingError::FileJSONError(format!("Failed to serialize search index: {}", e))
    })?;

    let mut file = BufWriter::new(fs::File::create(&tmp_path).await.map_err(|e| {
        ScrapingError::CreatingFileError(CreatingFileErrorStruct {
            source: e.to_string(),
            fn_name: "build_search_index".into(),
        })
    })?);

    file.write_all(json.as_bytes()).await.map_err(|e| {
        ScrapingError::CreatingFileError(CreatingFileErrorStruct {
            source: e.to_string(),
            fn_name: "build_search_index".into(),
        })
    })?;
    file.flush().await.ok();

    fs::rename(&tmp_path, &final_path).await.map_err(|e| {
        ScrapingError::CreatingFileError(CreatingFileErrorStruct {
            source: e.to_string(),
            fn_name: "build_search_index".into(),
        })
    })?;

    info!(
        "Search index written to {} in {:?}",
        final_path.display(),
        start.elapsed()
    );
    Ok(())
}

/// Get the path to the search index file
pub fn get_search_index_path(app_handle: &AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap()
        .join("sitemaps")
        .join("search-index.json")
}
