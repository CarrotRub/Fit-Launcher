use crate::{
    functions::get_all_download_links,
    structs::{DirectLink, FUCKINGFAST_DDL_REGEX},
};
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::StreamExt;
use specta::specta;
use std::pin::Pin;
use tracing::{error, warn};

type HtmlDownloadFuture =
    Pin<Box<dyn Send + std::future::Future<Output = Result<(String, String), reqwest::Error>>>>;

#[tauri::command]
#[specta]
pub async fn extract_fuckingfast_ddl(fuckingfast_links: Vec<String>) -> Vec<DirectLink> {
    futures::stream::iter(fuckingfast_links)
        // download raw HTML
        .map(|link| -> HtmlDownloadFuture {
            Box::pin(async move {
                let text = CUSTOM_DNS_CLIENT
                    .read()
                    .await
                    .get(&link)
                    .send()
                    .await?
                    .text()
                    .await?;
                let filename = link.split_once('#').unwrap_or_default().1.to_string();
                Ok::<(String, String), reqwest::Error>((text, filename))
            })
        })
        // limit max concurrency to avoid `rate limit` error
        .buffer_unordered(2)
        // send to tokio thread pool
        .filter_map(|info| async move {
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
        .collect()
        .into_future()
        .await
}

#[tauri::command]
#[specta]
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
