use std::sync::Arc;

use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
//TODO: Add a checker to not get all the games everytime, needs to be out before the update
use futures::{
    StreamExt,
    future::join_all,
    stream::{self, FuturesUnordered},
};
use scraper::{Html, Selector, selectable::Selectable};
use tokio::{fs, sync::Semaphore, task};

use crate::{errors::ScrapingError, structs::GamePage};

/// Helper function.
async fn check_url_status(url: &str) -> anyhow::Result<bool> {
    let response = CUSTOM_DNS_CLIENT.head(url).send().await.unwrap();
    Ok(response.status().is_success())
}

fn parse_image_links(body: &str, start: usize) -> anyhow::Result<Vec<String>> {
    let document = Html::parse_document(body);
    let mut images = Vec::new();

    for p_index in start..=5 {
        let selector = Selector::parse(&format!(
            ".entry-content > p:nth-of-type({}) img[src]",
            p_index
        ))
        .map_err(|_| anyhow::anyhow!("Invalid CSS selector for paragraph {}", p_index))?;

        for element in document.select(&selector) {
            if let Some(src) = element.value().attr("src") {
                images.push(src.to_string());
            }

            if images.len() >= 5 {
                return Ok(images); // Stop once we collect 5 images
            }
        }
    }

    Ok(images)
}

async fn process_image_link(src_link: String) -> anyhow::Result<String> {
    if src_link.contains("jpg.240p.") {
        let primary_image = src_link.replace("240p", "1080p");
        if check_url_status(&primary_image).await.unwrap_or(false) {
            return Ok(primary_image);
        }

        let fallback_image = primary_image.replace("jpg.1080p.", "");
        if check_url_status(&fallback_image).await.unwrap_or(false) {
            return Ok(fallback_image);
        }
    }

    Err(anyhow::anyhow!("No valid image found for {}", src_link))
}

async fn fetch_image_links(body: &str) -> anyhow::Result<Vec<String>> {
    let initial_images = parse_image_links(body, 3)?;

    // Spawn tasks for each image processing
    let tasks: Vec<_> = initial_images
        .into_iter()
        .map(|img_link| {
            task::spawn(async move {
                match process_image_link(img_link).await {
                    Ok(img) => Some(img),
                    Err(_) => None,
                }
            })
        })
        .collect();

    let results = join_all(tasks).await;

    // Collect successful, non-None results
    let mut processed = Vec::new();
    results.into_iter().for_each(|res| {
        if let Ok(Some(img)) = res {
            processed.push(img);
        }
    });

    Ok(processed)
}

async fn parse_and_process_page(body: String) -> Vec<GamePage> {
    let document = Html::parse_document(&body);

    let article_selector = Selector::parse("article").unwrap();
    let entry_title_selector = Selector::parse(".entry-title a").unwrap();
    let image_selector = Selector::parse(".entry-content .alignleft").unwrap();
    let desc_selector = Selector::parse("div.entry-content").unwrap();
    let magnet_selector = Selector::parse("a[href*='magnet']").unwrap();
    let tag_selector = Selector::parse(".entry-content p strong:first-of-type").unwrap();
    let hreflink_selector = Selector::parse(".entry-title > a").unwrap();

    let articles: Vec<_> = document.select(&article_selector).collect();

    let results: Vec<GamePage> = stream::iter(articles)
        .filter_map(|article_elem| {
            let entry_title_sel_value = entry_title_selector.clone();
            let entry_image_sel_value = image_selector.clone();
            let entry_desc_sel_value = desc_selector.clone();
            let entry_magnetlink_sel_value = magnet_selector.clone();
            let entry_tag_sel_value = tag_selector.clone();
            let entry_href_sel_value = hreflink_selector.clone();
            async move {
                let title = article_elem
                    .select(&entry_title_sel_value)
                    .next()
                    .and_then(|e| e.text().next())
                    .unwrap_or("")
                    .to_string();

                let img = article_elem
                    .select(&entry_image_sel_value)
                    .next()
                    .and_then(|e| e.value().attr("src"))
                    .unwrap_or("")
                    .to_string();

                let desc_elem = article_elem.select(&entry_desc_sel_value).next();
                let desc = desc_elem
                    .as_ref()
                    .map(|e| e.text().collect::<String>())
                    .unwrap_or_default();

                let magnet_link = desc_elem
                    .as_ref()
                    .and_then(|e| e.select(&entry_magnetlink_sel_value).next())
                    .and_then(|e| e.value().attr("href"))
                    .unwrap_or("")
                    .to_string();

                let tag = article_elem
                    .select(&entry_tag_sel_value)
                    .next()
                    .and_then(|e| e.text().next())
                    .unwrap_or("Unknown")
                    .to_string();

                let href = article_elem
                    .select(&entry_href_sel_value)
                    .next()
                    .and_then(|e| e.value().attr("href"))
                    .unwrap_or("")
                    .to_string();

                let secondary_images = fetch_image_links(&article_elem.html())
                    .await
                    .unwrap_or_default();

                if img.contains("imageban") {
                    Some(GamePage {
                        game_title: title,
                        game_main_image: img,
                        game_description: desc,
                        game_magnetlink: magnet_link,
                        game_secondary_images: secondary_images,
                        game_href: href,
                        game_tags: tag,
                    })
                } else {
                    None
                }
            }
        }) // Process up to 10 futures concurrently
        .collect()
        .await;

    results
}

#[tokio::main]
pub async fn get_100_games_unordered() -> Result<(), Box<ScrapingError>> {
    // Create a semaphore that only allows 5 concurrent tasks
    let concurrency_limit = Arc::new(Semaphore::new(5));

    let mut list_games_pages: Vec<GamePage> = Vec::new();

    // Collect futures in an unordered stream
    let fetch_tasks: FuturesUnordered<_> = (1..=10)
        .map(|page_number| {
            // Clone the Arc so each task has a handle to the same semaphore
            let concurrency_limit = concurrency_limit.clone();
            async move {
                // Acquire the semaphore permit – only 5 tasks can run this point concurrently
                let _permit = concurrency_limit.acquire_owned().await.unwrap();

                let url = format!(
                    "https://fitgirl-repacks.site/category/lossless-repack/page/{}",
                    page_number
                );

                match CUSTOM_DNS_CLIENT.get(&url).send().await {
                    Ok(res) if res.status().is_success() => match res.text().await {
                        Ok(text) => Ok(parse_and_process_page(text).await),
                        Err(_) => Err(format!("Failed to parse text for page {}", page_number)),
                    },
                    Ok(res) => Err(format!(
                        "Page {} returned unsuccessful status: {}",
                        page_number,
                        res.status()
                    )),
                    Err(err) => Err(format!("Failed to fetch page {}: {:?}", page_number, err)),
                }
            }
        })
        .collect();

    // Collect results outside the async closure
    let results: Vec<Result<Vec<GamePage>, String>> = fetch_tasks.collect().await;

    // Process each result
    for result in results {
        match result {
            Ok(parsed_pages) => {
                list_games_pages.extend(parsed_pages);
            }
            Err(err_msg) => {
                eprintln!("{}", err_msg);
            }
        }
    }

    println!("Processed {} game pages.", list_games_pages.len());

    // Asynchronous directory creation and file writing
    let discovery_file_path = directories::BaseDirs::new()
        .expect("Could not determine base directories")
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("tempGames")
        .join("discovery")
        .join("games_list.json");

    if let Some(parent_dir) = discovery_file_path.parent() {
        fs::create_dir_all(parent_dir)
            .await
            .expect("Failed to create directories for discovery file path");
    }

    let json_data = serde_json::to_string_pretty(&list_games_pages)
        .expect("Failed to serialize game pages to JSON");
    fs::write(discovery_file_path, json_data)
        .await
        .expect("Failed to write discovery file");

    Ok(())
}
