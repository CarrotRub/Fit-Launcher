pub mod basic_scraping {
    use anyhow::Result;
    use core::str;
    use futures::{
        stream::{FuturesOrdered, FuturesUnordered},
        StreamExt,
    };
    use serde::{Deserialize, Serialize};

    use std::path::Path;
    use std::time::Instant;

    use tauri::{Emitter, Manager};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tracing::{error, info};

    use crate::net_client_config::custom_client_dns::CUSTOM_DNS_CLIENT;

    #[derive(Debug, Serialize, Deserialize)]
    struct Game {
        title: String,
        img: String,
        desc: String,
        magnetlink: String,
        href: String,
        tag: String,
    }
    #[derive(Debug, thiserror::Error, Serialize, Deserialize)]
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

    #[derive(Debug, Serialize, Deserialize)]
    struct SingleGame {
        my_all_images: Vec<String>,
    }

    pub async fn download_sitemap(
        app_handle: tauri::AppHandle,
        url: &str,
        filename: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut response = CUSTOM_DNS_CLIENT.get(url).send().await?;

        let mut binding = app_handle.path().app_data_dir().unwrap();
        binding.push("sitemaps");

        let file_path = binding.join(format!("{}.xml", filename));

        let mut file = tokio::fs::File::create(&file_path).await?;
        while let Some(chunk) = response.chunk().await? {
            file.write_all(&chunk).await?;
        }

        Ok(())
    }

    /// Helper function.
    async fn check_url_status(url: &str) -> bool {
        let response = CUSTOM_DNS_CLIENT.head(url).send().await.unwrap();
        response.status().is_success()
    }

    #[tokio::main]
    pub async fn scraping_func(app_handle: tauri::AppHandle) -> Result<(), Box<ScrapingError>> {
        use tokio::fs;

        let start_time = Instant::now();
        let mut recently_up_games: Vec<Game> = Vec::new();

        // Fetch tasks for pages concurrently
        let fetch_tasks: FuturesOrdered<_> = (1..=2)
            .map(|page_number| async move {
                let url = format!(
                    "https://fitgirl-repacks.site/category/lossless-repack/page/{}",
                    page_number
                );
    
                let res = CUSTOM_DNS_CLIENT.get(&url).send().await.map_err(|e| {
                    eprintln!("Failed to get a response from URL: {}", &url);
                    ScrapingError::ReqwestError(e)
                }).unwrap();
    
                if !res.status().is_success() {
                    eprintln!(
                        "Error: Failed to connect to the website or the website is down. Status is : {:#?}",
                        res.status()
                    );
                    return Err(format!("Failed to fetch page {}", page_number));
                }
    
                let body = res.text().await.map_err(|e| {
                    eprintln!("Failed to get a body from URL: {}", &url);
                    ScrapingError::ReqwestError(e)
                }).unwrap();
    
                let document = scraper::Html::parse_document(&body);
                let article_selector = scraper::Selector::parse("article")
                    .map_err(|err| ScrapingError::SelectorError(err.to_string())).unwrap();
    
                let mut games_on_page = Vec::new();
    
                for article_elem in document.select(&article_selector) {
                    let title_elem = article_elem
                        .select(&scraper::Selector::parse(".entry-title a").unwrap())
                        .next();
                    let pic_elem = article_elem
                        .select(&scraper::Selector::parse(".entry-content .alignleft").unwrap())
                        .next();
                    let desc_elem = article_elem
                        .select(&scraper::Selector::parse("div.entry-content").unwrap())
                        .next();
                    let hreflink_elem = article_elem
                        .select(&scraper::Selector::parse(".entry-title > a").unwrap())
                        .next();
                    let tag_elem = article_elem
                        .select(
                            &scraper::Selector::parse(".entry-content p strong:first-of-type").unwrap(),
                        )
                        .next();
    
                    if let (Some(title_elem), Some(pic_elem), Some(desc_elem), Some(hreflink_elem)) =
                        (title_elem, pic_elem, desc_elem, hreflink_elem)
                    {
                        let title = title_elem.text().collect::<String>();
                        let img = pic_elem.value().attr("src").unwrap_or_default();
                        let desc = desc_elem.text().collect::<String>();
                        let href = hreflink_elem.value().attr("href").unwrap_or_default();
                        let tag = tag_elem
                            .map_or_else(|| "Unknown".to_string(), |e| e.text().collect::<String>());
    
                        let magnet_link = desc_elem
                            .select(&scraper::Selector::parse("a[href*='magnet']").unwrap())
                            .next()
                            .and_then(|elem| elem.value().attr("href"))
                            .unwrap_or_default();
    
                        if img.contains("imageban") {
                            games_on_page.push(Game {
                                title,
                                img: img.to_string(),
                                desc,
                                magnetlink: magnet_link.to_string(),
                                href: href.to_string(),
                                tag: tag.to_string(),
                            });
                        }
                    }
                }
    
                Ok(games_on_page)
            })
            .collect();

        // Collect results into a Vec
        let results: Vec<Result<Vec<Game>, String>> = fetch_tasks.collect().await;

        // Process the results
        for result in results {
            match result {
                Ok(parsed_games) => recently_up_games.extend(parsed_games),
                Err(err_msg) => eprintln!("{}", err_msg),
            }
        }

        // Create the directory for storing the JSON file
        let mut binding = app_handle.path().app_data_dir().unwrap();
        binding.push("tempGames");

        fs::create_dir_all(&binding).await.map_err(|e| {
            eprintln!("Failed to create directories: {:#?}", e);
            ScrapingError::CreatingFileError {
                source: e,
                fn_name: "scraping_func()".to_string(),
            }
        })?;

        let json_path = binding.join("newly_added_games.json");
        let temp_json_path = binding.join("newly_added_games.tmp.json");

        // Handle existing games for deduplication
        let mut existing_games: Vec<Game> = Vec::new();
        if json_path.exists() {
            let file_content = fs::read_to_string(&json_path).await.map_err(|e| {
                eprintln!("Error reading the existing file: {:#?}", e);
                ScrapingError::CreatingFileError {
                    source: e,
                    fn_name: "scraping_func()".to_string(),
                }
            })?;
            existing_games = serde_json::from_str(&file_content).map_err(|e| {
                eprintln!("Failed to parse existing JSON data: {:#?}", e);
                ScrapingError::FileJSONError(e)
            })?;
        }

        for (i, scraped_game) in recently_up_games.iter().enumerate() {
            if i < existing_games.len() && scraped_game.title == existing_games[i].title {
                println!(
                    "Game '{}' matches with the existing file. Stopping...",
                    scraped_game.title
                );
                return Ok(());
            }
        }

        // Write to the temp file
        let json_data = serde_json::to_string_pretty(&recently_up_games).map_err(|e| {
            eprintln!("Error serializing recently_up_games: {:#?}", e);
            ScrapingError::FileJSONError(e)
        })?;

        fs::write(&temp_json_path, &json_data).await.map_err(|e| {
            eprintln!("Error writing to the temp file: {:#?}", e);
            ScrapingError::CreatingFileError {
                source: e,
                fn_name: "scraping_func()".to_string(),
            }
        })?;

        // Rename the temp file to the final file
        fs::rename(&temp_json_path, &json_path).await.map_err(|e| {
            eprintln!("Error renaming temp file: {:#?}", e);
            ScrapingError::CreatingFileError {
                source: e,
                fn_name: "scraping_func()".to_string(),
            }
        })?;

        let duration_time_process = Instant::now() - start_time;
        info!(
            "Data has been written to newly_added_games.json. Time was: {:#?}",
            duration_time_process
        );

        Ok(())
    }

    #[tokio::main]
    pub async fn popular_games_scraping_func(
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<ScrapingError>> {
        let start_time = Instant::now();
        let mut popular_games: Vec<Game> = Vec::new();

        //TODO: Add selection for either of the month or of the year (default will be month from now on.) Through the settings front end.
        let url = "https://fitgirl-repacks.site/popular-repacks/";

        let res = match CUSTOM_DNS_CLIENT.get(url).send().await {
            Ok(response) => response,
            Err(e) => {
                eprintln!("Failed to get a response from URL: {}", url);
                eprintln!("Error: {:#?}", e);
                return Err(Box::new(ScrapingError::ReqwestError(e)));
            }
        };

        let body = match res.text().await {
            Ok(body) => body,
            Err(e) => {
                eprintln!("Failed to get a body from URL: {}", url);
                eprintln!("Error: {:#?}", e);

                return Err(Box::new(ScrapingError::ReqwestError(e)));
            }
        };

        let document = scraper::Html::parse_document(&body);

        let titles_selector = match scraper::Selector::parse(".widget-grid-view-image > a") {
            Ok(selector) => selector,
            Err(err) => {
                eprintln!("Error parsing titles selector: {:#?}", err);
                return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
            }
        };

        let images_selector = match scraper::Selector::parse(".widget-grid-view-image > a > img") {
            Ok(selector) => selector,
            Err(err) => {
                eprintln!("Error parsing images selector: {:#?}", err);
                return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
            }
        };

        let tag_selector = match scraper::Selector::parse(".entry-content p strong:first-of-type") {
            Ok(selector) => selector,
            Err(err) => {
                eprintln!("Error parsing tag selector: {:#?}", err);
                return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
            }
        };
        let description_selector = scraper::Selector::parse("div.entry-content").unwrap();
        let magnetlink_selector = match scraper::Selector::parse("a[href*='magnet']") {
            Ok(selector) => selector,
            Err(err) => {
                eprintln!("Error parsing magnetlink selector: {:#?}", err);
                return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
            }
        };

        let hreflink_selector = match scraper::Selector::parse(".widget-grid-view-image > a ") {
            Ok(selector) => selector,
            Err(err) => {
                eprintln!("Error parsing hreflink selector: {:#?}", err);
                return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
            }
        };

        let mut titles = document.select(&titles_selector);
        let mut images = document.select(&images_selector);
        let mut hreflinks = document.select(&hreflink_selector);

        // Prepare file path
        let mut binding = app_handle.path().app_data_dir().unwrap();
        binding.push("tempGames");
        binding.push("popular_games.json");

        if Path::new(&binding).exists() {
            // If file exists, read and compare
            let mut file = match tokio::fs::File::open(&binding).await {
                Ok(file) => file,
                Err(e) => {
                    eprintln!("Error opening the file: {:#?}", e);
                    return Err(Box::new(ScrapingError::CreatingFileError {
                        source: e,
                        fn_name: "popular_games_scraping_func()".to_string(),
                    }));
                }
            };

            let mut file_content = String::new();
            if let Err(e) = file.read_to_string(&mut file_content).await {
                eprintln!("Error reading file content: {:#?}", e);
                return Err(Box::new(ScrapingError::CreatingFileError {
                    source: e,
                    fn_name: "popular_games_scraping_func()".to_string(),
                }));
            }

            let existing_games: Vec<Game> = match serde_json::from_str(&file_content) {
                Ok(games) => games,
                Err(e) => {
                    error!("Failed to parse existing JSON data: {:#?}", e);
                    return Err(Box::new(ScrapingError::FileJSONError(e)));
                }
            };

            for (i, (title_elem, hreflink_elem)) in
                titles.clone().zip(hreflinks.clone()).enumerate()
            {
                let title = title_elem.value().attr("title").unwrap_or_default();
                let _href = hreflink_elem.value().attr("href").unwrap_or_default();

                if i < existing_games.len() && title == existing_games[i].title {
                    info!(
                        "Game '{}' matches with the existing file. Stopping...",
                        title
                    );
                    return Ok(()); // Stop the process if the game matches
                }
            }
        }

        // If no file exists or games do not match, continue with the scraping
        let mut game_count = 0;
        while let (Some(title_elem), Some(image_elem), Some(hreflink_elem)) =
            (titles.next(), images.next(), hreflinks.next())
        {
            let title = title_elem.value().attr("title").unwrap_or_default();
            let href = hreflink_elem.value().attr("href").unwrap_or_default();

            // Make a new request to get the description, magnet link, and tag
            let game_res = match CUSTOM_DNS_CLIENT.get(href).send().await {
                Ok(game_res) => game_res,
                Err(e) => {
                    eprintln!("Error getting game response: {:#?}", e);
                    continue;
                }
            };

            let game_body = match game_res.text().await {
                Ok(game_body) => game_body,
                Err(e) => {
                    eprintln!("Error getting game body: {:#?}", e);
                    continue;
                }
            };

            let game_doc = scraper::Html::parse_document(&game_body);

            // Extract description, magnet link, and tag
            let description_elem = game_doc.select(&description_selector).next();
            let magnetlink_elem = game_doc.select(&magnetlink_selector).next();
            let tag_elem = game_doc.select(&tag_selector).next();

            let description = description_elem
                .map(|elem| elem.text().collect::<String>())
                .unwrap_or_default();
            let magnetlink = magnetlink_elem
                .and_then(|elem| elem.value().attr("href"))
                .unwrap_or_default();
            let tag = tag_elem
                .map(|elem| elem.text().collect::<String>())
                .unwrap_or_default();

            let long_image_selector = match scraper::Selector::parse(
                ".entry-content > p:nth-of-type(3) a[href] > img[src]:nth-child(1)",
            ) {
                Ok(selector) => selector,
                Err(err) => {
                    eprintln!("Error parsing long_image_selector: {:#?}", err);
                    return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                }
            };

            let image_src = {
                let mut p_index = 3;
                let mut long_image_elem = game_doc.select(&long_image_selector).next();
                while long_image_elem.is_none() && p_index < 10 {
                    p_index += 1;
                    let updated_selector = scraper::Selector::parse(&format!(
                        ".entry-content > p:nth-of-type({}) a[href] > img[src]:nth-child(1)",
                        p_index
                    ))
                    .expect("Invalid selector");
                    long_image_elem = game_doc.select(&updated_selector).next();
                    if long_image_elem.is_some() {
                        break;
                    }
                }
                if let Some(elem) = long_image_elem {
                    let image_src = elem.value().attr("src").unwrap_or_default();
                    if image_src.contains("240p") {
                        let primary_image = image_src.replace("240p", "1080p");
                        if check_url_status(&primary_image).await {
                            primary_image.to_string()
                        } else {
                            let fallback_image = primary_image.replace("jpg.1080p.", "");
                            if check_url_status(&fallback_image).await {
                                fallback_image
                            } else {
                                image_src.to_string()
                            }
                        }
                    } else {
                        image_src.to_string()
                    }
                } else {
                    error!("Error Popular Games Scraping Func : long_image_elem is None");
                    "".to_string()
                }
            };

            game_count += 1;
            let popular_game = Game {
                title: title.to_string(),
                img: image_src.to_string(),
                desc: description,
                magnetlink: magnetlink.to_string(),
                href: href.to_string(),
                tag: tag.to_string(),
            };
            popular_games.push(popular_game);

            if game_count >= 8 {
                break;
            }
        }

        info!("Execution time: {:#?}", start_time.elapsed());
        let json_data = match serde_json::to_string_pretty(&popular_games) {
            Ok(json_d) => json_d,
            Err(e) => {
                eprintln!("Error serializing popular_games: {:#?}", e);
                return Err(Box::new(ScrapingError::FileJSONError(e)));
            }
        };

        let mut file = match tokio::fs::File::create(&binding).await {
            Ok(file) => file,
            Err(e) => {
                eprintln!("File could not be created: {:#?}", e);
                return Err(Box::new(ScrapingError::CreatingFileError {
                    source: e,
                    fn_name: "popular_games_scraping_func()".to_string(),
                }));
            }
        };

        if let Err(e) = file.write_all(json_data.as_bytes()).await {
            eprintln!("Error writing to the file popular_games.json: {:#?}", e);
            return Err(Box::new(ScrapingError::CreatingFileError {
                source: e,
                fn_name: "popular_games_scraping_func()".to_string(),
            }));
        }

        let end_time = Instant::now();
        let duration_time_process = end_time - start_time;
        info!(
            "Data has been written to popular_games.json. Time was: {:#?}",
            duration_time_process
        );

        Ok(())
    }

    #[tokio::main]
    pub async fn recently_updated_games_scraping_func(
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<ScrapingError>> {
        info!("Starting recently_updated_games_scraping_func...");

        let start_time = Instant::now();
        let mut recent_games: Vec<Game> = Vec::new();
        let url = "https://fitgirl-repacks.site/category/updates-digest/";

        let res = match CUSTOM_DNS_CLIENT.get(url).send().await {
            Ok(response) => response,
            Err(e) => {
                eprintln!("Network error while requesting {}: {}", &url, e);
                app_handle
                    .emit(
                        "scraping_failed",
                        format!(
                            "Failed to scrape recently updated games. Network error: {}",
                            e
                        ),
                    )
                    .unwrap();
                return Err(Box::new(ScrapingError::ReqwestError(e)));
            }
        };

        if !res.status().is_success() {
            eprintln!(
                "Error: Failed to connect to the website or the website is down. Status is : {:#?}",
                res.status()
            );
            app_handle
                .emit(
                    "scraping_failed",
                    format!("Failed to connect to {}. Website might be down.", &url),
                )
                .unwrap();
            return Ok(());
        }

        let body = match res.text().await {
            Ok(body) => body,
            Err(e) => {
                eprintln!("Failed to read response body from {}: {}", &url, e);
                app_handle
                    .emit(
                        "scraping_failed",
                        format!("Failed to read response body from {}.", &url),
                    )
                    .unwrap();
                return Ok(());
            }
        };

        let document = scraper::Html::parse_document(&body);
        let hreflink_selector =
            scraper::Selector::parse(".su-spoiler-content > a:first-child").unwrap();

        let hreflinks = document.select(&hreflink_selector);
        let mut game_count = 0;

        // Prepare paths for file operations
        let mut binding = app_handle.path().app_data_dir().unwrap();
        binding.push("tempGames");
        let json_path = binding.join("recently_updated_games.json");
        let temp_json_path = binding.join("recently_updated_games.tmp.json");

        for hreflink_elem in hreflinks {
            let href = match hreflink_elem.value().attr("href") {
                Some(href) => href,
                None => continue,
            };

            let game_res = match CUSTOM_DNS_CLIENT.get(href).send().await {
                Ok(game_res) => game_res,
                Err(e) => {
                    eprintln!(
                        "Network error while requesting game data from {}: {}",
                        href, e
                    );
                    app_handle
                        .emit(
                            "scraping_failed",
                            format!("Failed to fetch game data from {}.", href),
                        )
                        .unwrap();
                    continue;
                }
            };

            let game_body = match game_res.text().await {
                Ok(game_body) => game_body,
                Err(e) => {
                    eprintln!("Failed to read game response body from {}: {}", href, e);
                    app_handle
                        .emit(
                            "scraping_failed",
                            format!("Failed to read game response body from {}.", href),
                        )
                        .unwrap();
                    continue;
                }
            };

            let game_doc = scraper::Html::parse_document(&game_body);
            let title_selector = scraper::Selector::parse(".entry-title").unwrap();
            let images_selector = scraper::Selector::parse(".entry-content > p > a > img").unwrap();
            let description_selector = scraper::Selector::parse("div.entry-content").unwrap();
            let magnetlink_selector = scraper::Selector::parse("a[href*='magnet']").unwrap();
            let tag_selector =
                scraper::Selector::parse(".entry-content p strong:first-of-type").unwrap();

            let title = game_doc
                .select(&title_selector)
                .next()
                .map(|elem| elem.text().collect::<String>())
                .unwrap_or_default();
            let description = game_doc
                .select(&description_selector)
                .next()
                .map(|elem| elem.text().collect::<String>())
                .unwrap_or_default();
            let magnetlink = game_doc
                .select(&magnetlink_selector)
                .next()
                .and_then(|elem| elem.value().attr("href"))
                .unwrap_or_default();
            let image_src = game_doc
                .select(&images_selector)
                .next()
                .and_then(|elem| elem.value().attr("src"))
                .unwrap_or_default();
            let tag = game_doc
                .select(&tag_selector)
                .next()
                .map(|elem| elem.text().collect::<String>())
                .unwrap_or_else(|| "Unknown".to_string());

            game_count += 1;
            recent_games.push(Game {
                title,
                img: image_src.to_string(),
                desc: description,
                magnetlink: magnetlink.to_string(),
                href: href.to_string(),
                tag: tag.to_string(),
            });

            if game_count >= 20 {
                break;
            }
        }

        let json_data = match serde_json::to_string_pretty(&recent_games) {
            Ok(json_d) => json_d,
            Err(e) => {
                eprintln!("Error serializing recent_games: {:#?}", e);
                app_handle
                    .emit(
                        "scraping_failed",
                        "Failed to serialize recently updated games.",
                    )
                    .unwrap();
                return Err(Box::new(ScrapingError::FileJSONError(e)));
            }
        };

        let mut temp_file = match tokio::fs::File::create(&temp_json_path).await {
            Ok(file) => file,
            Err(e) => {
                eprintln!("Temp file could not be created: {:#?}", e);
                app_handle
                    .emit(
                        "scraping_failed",
                        "Failed to create temporary file for recently updated games.",
                    )
                    .unwrap();
                return Err(Box::new(ScrapingError::CreatingFileError {
                    source: e,
                    fn_name: "recently_updated_games_scraping_func()".to_string(),
                }));
            }
        };

        if let Err(e) = temp_file.write_all(json_data.as_bytes()).await {
            eprintln!("Error writing to the temporary file: {:#?}", e);
            return Err(Box::new(ScrapingError::CreatingFileError {
                source: e,
                fn_name: "recently_updated_games_scraping_func()".to_string(),
            }));
        }

        if let Err(e) = tokio::fs::rename(&temp_json_path, &json_path).await {
            eprintln!("Error renaming temp file: {:#?}", e);
            return Err(Box::new(ScrapingError::CreatingFileError {
                source: e,
                fn_name: "recently_updated_games_scraping_func()".to_string(),
            }));
        }

        let duration_time_process = start_time.elapsed();
        info!(
            "Data has been written to recently_updated_games.json. Time taken: {:#?}",
            duration_time_process
        );

        app_handle
            .emit(
                "scraping_complete",
                "Recently updated games scraping completed.",
            )
            .unwrap();

        Ok(())
    }
}

pub mod commands_scraping {

    use core::str;
    use scraper::Selector;
    use serde::{Deserialize, Serialize};
    use std::fs;
    use tauri::Manager;
    use tracing::info;

    use anyhow::Result;
    use std::fmt;
    use std::fs::File;
    use std::io::Write;
    use std::path::Path;
    use std::time::Instant;

    use crate::basic_scraping;
    use crate::net_client_config::custom_client_dns::CUSTOM_DNS_CLIENT;

    #[derive(Debug, Serialize, Deserialize)]
    struct SingularGame {
        title: String,
        img: String,
        desc: String,
        magnetlink: String,
        href: String,
        tag: String,
    }

    #[derive(Debug, Serialize)]
    pub struct SingularFetchError {
        message: String,
    }

    impl fmt::Display for SingularFetchError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }

    impl std::error::Error for SingularFetchError {}

    impl From<reqwest::Error> for SingularFetchError {
        fn from(error: reqwest::Error) -> Self {
            SingularFetchError {
                message: error.to_string(),
            }
        }
    }

    impl From<std::io::Error> for SingularFetchError {
        fn from(error: std::io::Error) -> Self {
            SingularFetchError {
                message: error.to_string(),
            }
        }
    }

    impl From<serde_json::Error> for SingularFetchError {
        fn from(error: serde_json::Error) -> Self {
            SingularFetchError {
                message: error.to_string(),
            }
        }
    }

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
            basic_scraping::download_sitemap(my_app_handle, &relative_url, &relative_filename)
                .await?;
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
        let tag_selector =
            scraper::Selector::parse(".entry-content p strong:first-of-type").unwrap();

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
}
