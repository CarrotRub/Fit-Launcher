use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use scraper::Selector;
use std::fs;
use tauri::Manager;
use tracing::info;

use anyhow::Result;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::time::Instant;

use crate::errors::SingularFetchError;
use crate::structs::SingularGame;

use super::functions::download_sitemap;

#[tokio::main]
pub async fn get_sitemaps_website(
    app_handle: tauri::AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut all_files_exist = true;

    let mut binding = app_handle.path().app_data_dir().unwrap();

    binding.push("sitemaps");

    match Path::new(&binding).exists() {
        true => (),
        false => {
            tokio::fs::create_dir_all(&binding).await?;
        }
    }

    // Check for the first 5 files
    for page_number in 1..=5 {
        let relative_filename = format!("post-sitemap{}.xml", page_number);
        let concrete_path = &binding.join(relative_filename);
        if !Path::new(concrete_path).try_exists().unwrap() {
            all_files_exist = false;
            break;
        }
    }

    // If all first 5 files exist, only download the 5th file
    let range = if all_files_exist { 6..=6 } else { 1..=6 };

    // Download files as needed
    for page_number in range {
        let relative_url = format!(
            "https://fitgirl-repacks.site/post-sitemap{}.xml",
            page_number
        );
        let relative_filename = format!("post-sitemap{}", page_number);

        let my_app_handle = app_handle.clone();
        download_sitemap(my_app_handle, &relative_url, &relative_filename).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_singular_game_info(
    app_handle: tauri::AppHandle,
    game_link: String,
) -> Result<(), SingularFetchError> {
    let start_time = Instant::now();

    let mut searched_game: Vec<SingularGame> = Vec::new();

    let url = game_link.as_str();
    let game_res = CUSTOM_DNS_CLIENT.get(url).send().await?;

    let game_body = game_res.text().await?;
    let game_doc = scraper::Html::parse_document(&game_body);

    let title_selector = scraper::Selector::parse(".entry-title").unwrap();
    let images_selector = scraper::Selector::parse(".entry-content > p > a > img").unwrap();
    let description_selector = Selector::parse("div.entry-content").unwrap();
    let magnetlink_selector = scraper::Selector::parse("a[href*='magnet']").unwrap();
    let tag_selector = scraper::Selector::parse(".entry-content p strong:first-of-type").unwrap();

    let title_elem = game_doc.select(&title_selector).next();
    let description_elem = game_doc.select(&description_selector).next();
    let magnetlink_elem = game_doc.select(&magnetlink_selector).next();
    let image_elem = game_doc.select(&images_selector).next();
    let tag_elem = game_doc.select(&tag_selector).next();

    let title = title_elem
        .map(|elem| elem.text().collect::<String>())
        .unwrap_or_default();
    let description = description_elem
        .map(|elem| elem.text().collect::<String>())
        .unwrap_or_default();
    let magnetlink = magnetlink_elem
        .and_then(|elem| elem.value().attr("href"))
        .unwrap_or_default();
    let image_src = image_elem
        .and_then(|elem| elem.value().attr("src"))
        .unwrap_or_default();
    let tag = tag_elem
        .map(|elem| elem.text().collect::<String>())
        .unwrap_or_else(|| "Unknown".to_string()); // Collecting the tag

    let singular_searched_game = SingularGame {
        title: title.to_string(),
        img: image_src.to_string(),
        desc: description,
        magnetlink: magnetlink.to_string(),
        href: url.to_string(),
        tag: tag.to_string(),
    };

    searched_game.push(singular_searched_game);

    let json_data = serde_json::to_string_pretty(&searched_game)?;
    let mut binding = app_handle.path().app_data_dir().unwrap();

    match Path::new(&binding).exists() {
        true => (),
        false => {
            fs::create_dir_all(&binding)?;
        }
    }
    binding.push("tempGames");
    binding.push("singular_game_temp.json");

    let mut file = File::create(binding).expect("File could not be created !");

    file.write_all(json_data.as_bytes())?;

    let end_time = Instant::now();
    let duration_time_process = end_time - start_time;
    info!(
        "Data has been written to singular_game_temp.json. Time was : {:#?}",
        duration_time_process
    );

    Ok(())
}
