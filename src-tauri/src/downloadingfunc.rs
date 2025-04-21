pub mod downloads_function {
    use std::{future::IntoFuture, pin::Pin};

    use anyhow::Result;
    use futures::StreamExt;
    use once_cell::sync::Lazy;
    use regex::Regex;
    use serde::{Deserialize, Serialize};
    use tracing::{error, warn};

    use crate::CUSTOM_DNS_CLIENT;

    const FUCKINGFAST_DDL_REGEX: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r#"window\.open\(\"(https://fuckingfast.co/dl/[^"]*)\"\)"#).unwrap()
    });

    #[derive(Debug, Default, Serialize, Deserialize)]
    pub struct DirectLink {
        pub url: String,
        pub filename: String,
    }
    #[derive(Debug, Default)]
    pub struct GameInfoLinks {
        pub href: String,
        pub download_links: Vec<String>,
    }

    #[derive(Debug, thiserror::Error, Serialize, Deserialize)]
    #[allow(clippy::enum_variant_names, dead_code)]
    pub enum ScrapingError {
        #[error("Request Error: {0}")]
        #[serde(skip)]
        ReqwestError(#[from] reqwest::Error),

        #[error("Selector Parsing Error: {0}")]
        SelectorError(String),

        #[error("Modifying JSON Error: {0}")]
        #[serde(skip)]
        FileJSONError(#[from] serde_json::Error),

        #[error("Creating File Error in `{fn_name}`: {source}")]
        #[serde(skip)]
        CreatingFileError {
            source: std::io::Error,
            fn_name: String,
        },
        #[error("Global Error: {0}")]
        #[serde(skip)]
        GlobalError(String),
    }

    async fn get_all_download_links(url: String) -> Result<Vec<String>, Box<ScrapingError>> {
        let response = CUSTOM_DNS_CLIENT
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                eprintln!("Failed to get response from URL: {}", &url);
                eprintln!("Error is: {}", e);
                ScrapingError::ReqwestError(e)
            })
            .expect("Error getting response from URL, please check the logs.");

        if !response.status().is_success() {
            eprintln!(
                "Error: Failed to connect to the website or the website is down. Status is : {:#?}",
                response.status()
            );
            return Err(Box::new(ScrapingError::GlobalError(format!(
                "Error: Failed to connect to the website or the website is down. Status is : {:#?}",
                response.status()
            ))));
        }

        let body = response
            .text()
            .await
            .map_err(|e| {
                eprintln!("Failed to get a body from URL: {}", &url);
                ScrapingError::ReqwestError(e)
            })
            .unwrap();

        let html_document = scraper::Html::parse_document(&body);
        let a_selector = scraper::Selector::parse("a").unwrap();
        let mut fucking_fast_links = Vec::new();
        for element in html_document.select(&a_selector) {
            if element.text().any(|t| t.contains("FuckingFast")) {
                if let Some(href) = element.value().attr("href") {
                    fucking_fast_links.push(href.to_string());
                }
            }
        }

        let spoiler_selector =
            scraper::Selector::parse(".su-spoiler-content.su-u-clearfix.su-u-trim").unwrap();
        let spoiler_content: Vec<String> = html_document
            .select(&spoiler_selector)
            .map(|element| element.inner_html())
            .collect();

        // Extract all <a> href containing "_fitgirl-repacks.site_" because the others are for updates
        let mut original_repack_links = Vec::new();

        for content in &spoiler_content {
            let spoiler_doc = scraper::Html::parse_fragment(content);
            for element in spoiler_doc.select(&a_selector) {
                if let Some(href) = element.value().attr("href") {
                    if href.contains("_fitgirl-repacks.site_") {
                        original_repack_links.push(href.to_string());
                    }
                }
            }
        }

        let mut result_links = Vec::new();
        result_links.append(&mut original_repack_links);
        result_links.append(&mut fucking_fast_links);

        Ok(result_links)
    }

    #[tauri::command]
    pub async fn extract_fuckingfast_ddl(fuckingfast_links: Vec<String>) -> Vec<DirectLink> {
        futures::stream::iter(fuckingfast_links)
            // download raw HTML
            .map(
                |link| -> Pin<Box<dyn std::future::Future<Output = Result<(String, String), _>>>> {
                    Box::pin(async move {
                        let text = CUSTOM_DNS_CLIENT.get(&link).send().await?.text().await?;
                        let filename = link.split_once('#').unwrap_or_default().1.to_string();
                        Ok::<(String, String), reqwest::Error>((text, filename))
                    })
                },
            )
            // limit max concurrency to avoid `rate limit` error
            .buffer_unordered(2)
            // send to tokio thread pool
            .filter_map(|info| async move {
                tokio::task::spawn_blocking(move || {
                    let (html, filename) = info.ok()?;

                    if html.contains("rate limit") {
                        error!("triggered rate limit! must setup a proxy or wait for minutes");
                        return None;
                    }
                    if html.contains("File Not Found Or Deleted") {
                        warn!("a file is missing");
                        return None;
                    }

                    FUCKINGFAST_DDL_REGEX
                        .captures(&html)?
                        .get(1)
                        .map(|m| m.as_str().to_string())
                        .map(|url| DirectLink { url, filename })
                })
                .await
                .unwrap()
            })
            .collect()
            .into_future()
            .await
    }

    #[tauri::command]
    pub async fn get_datahoster_links(
        game_link: String,
        datahoster_name: String,
    ) -> Option<Vec<String>> {
        let all_links = get_all_download_links(game_link).await.ok()?;
        let filtered_links: Vec<String> = all_links
            .into_iter()
            .filter(|link| link.to_lowercase().contains(&datahoster_name))
            .collect();

        if filtered_links.is_empty() {
            None
        } else {
            Some(filtered_links)
        }
    }
}
