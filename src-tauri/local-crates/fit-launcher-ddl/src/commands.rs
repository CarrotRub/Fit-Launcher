use std::time::Duration;

use crate::{
    FUCKINGFAST_SIZE_REGEX,
    functions::{get_all_download_links, parse_size_to_bytes},
    structs::{DirectLink, FUCKINGFAST_DDL_REGEX},
};
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use futures::{StreamExt, stream::FuturesUnordered};
use reqwest::{Method, Request};
use specta::specta;
use tracing::{error, info, warn};

#[tauri::command]
#[specta]
pub async fn extract_fuckingfast_ddl(fuckingfast_links: Vec<String>) -> Vec<DirectLink> {
    let mut futures = FuturesUnordered::new();

    for link in fuckingfast_links {
        let fut = async move {
            let request = Request::new(
                Method::GET,
                link.parse().map_err(|_| anyhow::anyhow!("invalid URL"))?,
            );
            let mut i = 0;
            loop {
                i += 1;

                let sleep = Duration::from_millis((500 * 2_u64.pow(i)).min(4000));
                match CUSTOM_DNS_CLIENT
                    .read()
                    .await
                    .execute(request.try_clone().unwrap())
                    .await
                {
                    Err(e) if i < 5 => {
                        error!("retry: {e}, sleep...");
                        tokio::time::sleep(sleep).await;
                    }
                    Err(e) => {
                        break Result::<_, anyhow::Error>::Err(e.into());
                    }
                    Ok(resp) => {
                        if let Ok(text) = resp.text().await {
                            let filename = link.split_once('#').unwrap_or_default().1.to_string();
                            break Ok((text, filename));
                        }
                    }
                }
            }
        };
        futures.push(fut);
    }

    let mut results = Vec::new();

    while let Some(Ok((html, filename))) = futures.next().await {
        if html.contains("rate limit") {
            error!("triggered rate limit!");
            continue;
        }
        if html.contains("File Not Found Or Deleted") {
            warn!("a file is missing");
            continue;
        }

        if let Some(url) = FUCKINGFAST_DDL_REGEX
            .captures(&html)
            .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
        {
            let size = FUCKINGFAST_SIZE_REGEX
                .captures(&html)
                .map(|c| {
                    let number = c.get(1).map(|m| m.as_str()).unwrap_or("0");
                    let unit = c.get(2).map(|m| m.as_str()).unwrap_or("B");
                    parse_size_to_bytes(number, unit)
                })
                .unwrap_or(0);

            results.push(DirectLink {
                url,
                filename,
                size,
            });
        }
    }

    results
}

/// TODO: this isn't workin at all btw
///
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
        info!("Found datahoster links: {:#?}", &filtered_links);
        Some(filtered_links)
    }
}
