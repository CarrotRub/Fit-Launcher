
pub mod basic_scraping {

    use librqbit::Session;
    use serde::{Deserialize, Serialize};
    use core::str;
    use std::fs;
    use scraper::{Html, Selector};
    use reqwest::Client;
    use std::fs::File;
    use std::io::Write;
    use std::time::Instant;

    use std::path::Path;
    use anyhow::Result;
    use tokio::sync::Mutex;
    use std::sync::Arc;
    use lazy_static::lazy_static;


    lazy_static! {
        static ref SESSION: Mutex<Option<Arc<Session>>> = Mutex::new(None);
    }

    #[derive(Debug, Serialize, Deserialize)]
    struct Game {
        title: String,
        img: String,
        desc: String,
        magnetlink: String,
        href: String
    }

    #[derive(Debug, thiserror::Error)]
    pub enum ScrapingError {
        #[error("Request Error: {0}")]
        ReqwestError(#[from] reqwest::Error),
        
        #[error("Selector Parsing Error: {0}")]
        SelectorError(String),

        #[error("Modifying JSON Error: {0}")]
        FileJSONError(#[from] serde_json::Error),

        #[error("Creating File Error: {0}")]
        CreatingFileError(#[from] std::io::Error),
        
    }

    #[derive(Debug, Serialize, Deserialize)]
    struct SingleGame {
        my_all_images: Vec<String>,
    }

        #[tokio::main]
    pub async fn scraping_func(app_handle: tauri::AppHandle) -> Result<(), Box<ScrapingError>> {
            let start_time = Instant::now();
            let client = Client::new();
            let mut recently_up_games: Vec<Game> = Vec::new();
        
            // Change the number of pages it will scrap, knowing that there are 10 games per page.
            // Only for recent games.
            for page_number in 1..=2 {
                let url = format!("https://fitgirl-repacks.site/category/lossless-repack/page/{}", page_number);

                let res = match client.get(&url).send().await {
                    Ok(response) => response,
                    Err(e) => {
                        eprintln!("Failed to get a response from URL: {}", &url);
                        eprintln!("Error: {:#?}", e);
                        return Err(Box::new(ScrapingError::ReqwestError(e)));
                    }
                };
                
                println!("After HTTP request");
                if !res.status().is_success() {
                    eprintln!("Error: Failed to connect to the website or the website is down.");
                    return Ok(());
                }
        
                let body = match res.text().await {
                    Ok(body) => body,
                    Err(e) => {
                        eprintln!("Failed to get a body from URL: {}", &url);
                        eprintln!("Error: {:#?}", e);
                        return Err(Box::new(ScrapingError::ReqwestError(e)));
                    }
                };

                let document = Html::parse_document(&body);
            
                let titles_selector = match Selector::parse(".entry-title a") {
                    Ok(selector) => selector,
                    Err(err) => {
                        eprintln!("Error parsing titles selector: {:#?}", err);
                        return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                    }
                };
            
                let pics_selector = match Selector::parse(".alignleft") {
                    Ok(selector) => selector,
                    Err(err) => {
                        eprintln!("Error parsing images selector: {:#?}", err);
                        return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                    }
                };
            
                let desc_selector = match Selector::parse("div.entry-content") {
                    Ok(selector) => selector,
                    Err(err) => {
                        eprintln!("Error parsing description selector: {:#?}", err);
                        return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                    }
                };

                let hreflink_selector = match Selector::parse(".entry-title > a") {
                    Ok(selector) => selector,
                    Err(err) => {
                        eprintln!("Error parsing hreflink selector: {:#?}", err);
                        return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                    }
                };
            
                for (((title_elem, pic_elem), desc_elem), hreflink_elem) in document
                    .select(&titles_selector)
                    .zip(document.select(&pics_selector))
                    .zip(document.select(&desc_selector))
                    .zip(document.select(&hreflink_selector))
                {
                    let title = title_elem.text().collect::<String>();
                    let img = pic_elem.value().attr("src").unwrap_or_default();
                    let desc = desc_elem.text().collect::<String>();
                    let href = hreflink_elem.value().attr("href").unwrap_or_default();
                
                    // Get the first magnet link for this entry-content
                    let magnet_link = desc_elem
                        .select(&Selector::parse("a[href*='magnet']").unwrap())
                        .next()
                        .and_then(|elem| elem.value().attr("href"))
                        .unwrap_or_default();
                
                    // Check if the image link contains "imageban"
                    if img.contains("imageban") {
                        let game = Game {
                            title: title,
                            img: img.to_string(),
                            desc: desc,
                            magnetlink: magnet_link.to_string(),
                            href: href.to_string(),
                        };
                        recently_up_games.push(game);
                    }
                }
            }

            // Serialize the data with pretty formatting
            let json_data = match serde_json::to_string_pretty(&recently_up_games) {
                Ok(json_d) => json_d,
                Err(e) => {
                    eprintln!("Error serializing popular_games: {:#?}", e);
                    return Err(Box::new(ScrapingError::FileJSONError(e)));
                }
            };
            let mut binding = app_handle.path_resolver().app_data_dir().unwrap();
        
            binding.push("tempGames");
        
            // Ensure the directory exists, or create it
            if !Path::new(&binding).exists() {
                if let Err(e) = fs::create_dir_all(&binding) {
                    eprintln!("Error creating directories: {:#?}", e);
                    return Err(Box::new(ScrapingError::SelectorError(e.to_string())));
                }
            }

            binding.push("newly_added_games.json");
        
            // Write the JSON data to a file named popular_games.json inside the app data directory tempGames
            let mut file = match File::create(&binding) {
                Ok(file) => file,
                Err(e) => {
                    eprintln!("File could not be created: {:#?}", e);
                    return Err(Box::new(ScrapingError::CreatingFileError(e)));
                }
            };

            if let Err(e) = file.write_all(json_data.as_bytes()) {
                eprintln!("Error writing to the file popular_games.json: {:#?}", e);
                return Err(Box::new(ScrapingError::CreatingFileError(e)));
            }
            
            let end_time = Instant::now();
            let duration_time_process = end_time - start_time;
            println!("Data has been written to newly_added_games.json. Time was : {:#?}", duration_time_process);
        
            Ok(())
        }
    

        #[tokio::main]
        pub async fn popular_games_scraping_func(app_handle: tauri::AppHandle) -> Result<(), Box<ScrapingError>>  {
            let start_time = Instant::now();
            let mut popular_games: Vec<Game> = Vec::new();
            
            let client = reqwest::Client::new();
            let url = "https://fitgirl-repacks.site/popular-repacks-of-the-year/";
            
            let res = match client.get(url).send().await {
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
        
            let document = Html::parse_document(&body);
        
            let titles_selector = match Selector::parse(".widget-grid-view-image > a") {
                Ok(selector) => selector,
                Err(err) => {
                    eprintln!("Error parsing titles selector: {:#?}", err);
                    return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                }
            };
        
            let images_selector = match Selector::parse(".widget-grid-view-image > a > img") {
                Ok(selector) => selector,
                Err(err) => {
                    eprintln!("Error parsing images selector: {:#?}", err);
                    return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                }
            };
        
            let description_selector = Selector::parse("div.entry-content").unwrap();
        
            let magnetlink_selector = match Selector::parse("a[href*='magnet']") {
                Ok(selector) => selector,
                Err(err) => {
                    eprintln!("Error parsing magnetlink selector: {:#?}", err);
                    return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                }
            };
        
            let hreflink_selector = match Selector::parse(".widget-grid-view-image > a ") {
                Ok(selector) => selector,
                Err(err) => {
                    eprintln!("Error parsing hreflink selector: {:#?}", err);
                    return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                }
            };
        
        
            let mut titles = document.select(&titles_selector);
            let mut images = document.select(&images_selector);
            let mut hreflinks = document.select(&hreflink_selector);
        
            let mut game_count = 0;
            while let (Some(title_elem), Some(image_elem), Some(hreflink_elem)) = (titles.next(), images.next(), hreflinks.next()) {
                let title = title_elem.value().attr("title");
                let href = hreflink_elem.value().attr("href").unwrap();
            
                // Make a new request to get the description and magnet link
                let game_res = match client.get(href).send().await {
                    Ok(game_res) => game_res,
                    Err(e) => {
                        eprintln!("Error getting game response: {:#?}", e);
                        return Err(Box::new(ScrapingError::ReqwestError(e)));
                    }
                };
                let game_body = match game_res.text().await {
                    Ok(game_body) => game_body,
                    Err(e) => {
                        eprintln!("Error getting game body: {:#?}", e);
                        return Err(Box::new(ScrapingError::ReqwestError(e)));
                    }
                };
        
                let game_doc = scraper::Html::parse_document(&game_body);
            
                // Extract description and magnet link from the new document
                let description_elem = game_doc.select(&description_selector).next();
                let magnetlink_elem = game_doc.select(&magnetlink_selector).next();
            
                let description = description_elem.map(|elem| elem.text().collect::<String>()).unwrap_or_default();
                let magnetlink = magnetlink_elem.and_then(|elem| elem.value().attr("href")).unwrap_or_default();
                let long_image_selector = match scraper::Selector::parse(".entry-content > p:nth-of-type(3) a[href] > img[src]:nth-child(1)") {
                    Ok(selector) => selector,
                    Err(err) => {
                        eprintln!("Error parsing long_image_selector: {:#?}", err);
                        return Err(Box::new(ScrapingError::SelectorError(err.to_string())));
                    }
                };
                
                // Determine the image source based on whether it's the first game or not
                let image_src = if game_count == 0 {
                    let mut p_index = 3;
                    let mut long_image_elem = game_doc.select(&long_image_selector).next();
                    while long_image_elem.is_none() && p_index < 10 {
                        p_index += 1;
                        println!("yo {}", p_index);
                        let updated_selector = scraper::Selector::parse(&format!(".entry-content > p:nth-of-type({}) a[href] > img[src]:nth-child(1)", p_index))
                            .expect("Invalid selector");
                        long_image_elem = game_doc.select(&updated_selector).next();
                        if long_image_elem.is_some() {
                            break;
                        }
                    }
                    if let Some(elem) = long_image_elem {
                        elem.value().attr("src").unwrap_or_default()
                    } else {
                        "Error, no image found!"
                    }
                } else {
                    image_elem.value().attr("src").unwrap_or_default()
                };
            
                game_count += 1;
                let popular_game = Game {
                    title: title.expect("I don't know how you can make this not work tbh").to_string(),
                    img: image_src.to_string(),
                    desc: description,
                    magnetlink: magnetlink.to_string(),
                    href: href.to_string()
                };
            
                popular_games.push(popular_game);
            
                if game_count >= 20 {
                    break;
                }
            }
            
            println!("Execution time: {:#?}", start_time.elapsed());
            let json_data = match serde_json::to_string_pretty(&popular_games) {
                Ok(json_d) => json_d,
                Err(e) => {
                    eprintln!("Error serializing popular_games: {:#?}", e);
                    return Err(Box::new(ScrapingError::FileJSONError(e)));
                }
            };
        
            let mut binding = app_handle.path_resolver().app_data_dir().unwrap();
            
            binding.push("tempGames");
        
            // Ensure the directory exists, or create it
            if !Path::new(&binding).exists() {
                if let Err(e) = fs::create_dir_all(&binding) {
                    eprintln!("Error creating directories: {:#?}", e);
                    return Err(Box::new(ScrapingError::SelectorError(e.to_string())));
                }
            }
            
            binding.push("popular_games.json");
        
            // Write the JSON data to a file named popular_games.json inside the app data directory tempGames
            let mut file = match File::create(&binding) {
                Ok(file) => file,
                Err(e) => {
                    eprintln!("File could not be created: {:#?}", e);
                    return Err(Box::new(ScrapingError::CreatingFileError(e)));
                }
            };
        
            if let Err(e) = file.write_all(json_data.as_bytes()) {
                eprintln!("Error writing to the file popular_games.json: {:#?}", e);
                return Err(Box::new(ScrapingError::CreatingFileError(e)));
            }
            
            let end_time = Instant::now();
            let duration_time_process = end_time - start_time;
            println!("Data has been written to popular_games.json. Time was: {:#?}", duration_time_process);
            Ok(())
        }


    #[tokio::main]
    pub async fn recently_updated_games_scraping_func(app_handle: tauri::AppHandle) -> Result<(), Box<ScrapingError>> {

        println!("Before HTTP request");
        let start_time = Instant::now();
        let mut recent_games: Vec<Game> = Vec::new();

        let client = reqwest::Client::new();

        let url = "https://fitgirl-repacks.site/category/updates-digest/";
        let res = match client.get(url).send().await {
            Ok(response) => response,
            Err(e) => {
                eprintln!("Failed to get a response from URL: {}", &url);
                eprintln!("Error: {:#?}", e);
                return Err(Box::new(ScrapingError::ReqwestError(e)));
            }
        };

        println!("After HTTP request");
        if !res.status().is_success() {
            eprintln!("Error: Failed to connect to the website or the website is down.");
            return Ok(());
        }

        let body = match res.text().await {
            Ok(body) => body,
            Err(e) => {
                eprintln!("Failed to get a body from URL: {}", &url);
                eprintln!("Error: {:#?}", e);
                return Err(Box::new(ScrapingError::ReqwestError(e)));
            }
        };

        let document = scraper::Html::parse_document(&body);

        let title_selector = scraper::Selector::parse(".entry-title").unwrap();
        let images_selector = scraper::Selector::parse(".entry-content > p > a > img").unwrap();
        let description_selector = Selector::parse("div.entry-content").unwrap();
        let magnetlink_selector = scraper::Selector::parse("a[href*='magnet']").unwrap();
        let hreflink_selector = scraper::Selector::parse(".su-spoiler-content > a:first-child").unwrap();


        let mut hreflinks = document.select(&hreflink_selector);
        let mut game_count = 0;

        println!("hi first");

        while let Some(hreflink_elem) = hreflinks.next() {

            let href = match hreflink_elem.value().attr("href") {
                Some(href) => href,
                None => continue, // Skip if there's no href attribute
            };
        
            // Try to get the response from the href link
            let game_res = match client.get(href).send().await {
                Ok(response) => response,
                Err(_) => {
                    // Log the error, then continue to the next iteration
                    eprintln!("Failed to get response from: {}", href);
                    continue;
                }
            };
            
            let game_body = match game_res.text().await {
                Ok(body) => body,
                Err(_) => {
                    // Log the error, then continue to the next iteration
                    eprintln!("Failed to read body text from: {}", href);
                    continue;
                }
            };
        
            let game_doc = scraper::Html::parse_document(&game_body);


        
            let title_elem = game_doc.select(&title_selector).next();
            let description_elem = game_doc.select(&description_selector).next();
            let magnetlink_elem = game_doc.select(&magnetlink_selector).next();
            let image_elem = game_doc.select(&images_selector).next();
        
            

            let title = title_elem.map(|elem| elem.text().collect::<String>()).unwrap_or_default();
            let description = description_elem.map(|elem| elem.text().collect::<String>()).unwrap_or_default();
            let magnetlink = magnetlink_elem.and_then(|elem| elem.value().attr("href")).unwrap_or_default();
            let image_src = image_elem.and_then(|elem| elem.value().attr("src")).unwrap_or_default();


            game_count += 1;
            let recently_updated_game =  Game {
                title: title.to_string(),
                img: image_src.to_string(),
                desc: description,
                magnetlink: magnetlink.to_string(),
                href: href.to_string()
            };

            recent_games.push(recently_updated_game);

            if game_count >= 20 {
                break;
            }
        }

        println!("Execution time: {:#?}", start_time.elapsed());
        let json_data = match serde_json::to_string_pretty(&recent_games) {
            Ok(json_d) => json_d,
            Err(e) => {
                eprintln!("Error serializing popular_games: {:#?}", e);
                return Err(Box::new(ScrapingError::FileJSONError(e)));
            }
        };
    
        let mut binding = app_handle.path_resolver().app_data_dir().unwrap();

        binding.push("tempGames");

        if !Path::new(&binding).exists() {
            if let Err(e) = fs::create_dir_all(&binding) {
                eprintln!("Error creating directories: {:#?}", e);
                return Err(Box::new(ScrapingError::SelectorError(e.to_string())));
            }
        }

        binding.push("recently_updated_games.json");

        
        // Write the JSON data to a file named popular_games.json inside the app data directory tempGames
        let mut file = match File::create(&binding) {
            Ok(file) => file,
            Err(e) => {
                eprintln!("File could not be created: {:#?}", e);
                return Err(Box::new(ScrapingError::CreatingFileError(e)));
            }
        };
        
        if let Err(e) = file.write_all(json_data.as_bytes()) {
            eprintln!("Error writing to the file popular_games.json: {:#?}", e);
            return Err(Box::new(ScrapingError::CreatingFileError(e)));
        }
        
        let end_time = Instant::now();
        let duration_time_process = end_time - start_time;
        println!("Data has been written to recently_updated_games.json. Time was : {:#?}", duration_time_process);

        Ok(())
    }



}

pub mod commands_scraping {

    use serde::{Deserialize, Serialize};
    use core::str;
    use std::fs;
    use scraper::Selector;

    use std::fs::File;
    use std::io::Write;
    use std::time::Instant;
    use std::fmt;
    use std::path::Path;
    use anyhow::Result;


    #[derive(Debug, Serialize, Deserialize)]
    struct SingularGame {
        title: String,
        img: String,
        desc: String,
        magnetlink: String,
        href: String
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
    

    #[tauri::command]
    pub async fn get_singular_game_info(app_handle: tauri::AppHandle, game_link: String) -> Result<(), SingularFetchError> {

        println!("Before HTTP request");
        println!("{:#?}", game_link);
        let start_time = Instant::now();
        let mut searched_game: Vec<SingularGame> = Vec::new();
        let client = reqwest::Client::new();

        let url = game_link.as_str();
        let game_res = client.get(url).send().await?;

        let game_body = game_res.text().await?;
        let game_doc = scraper::Html::parse_document(&game_body);
        println!("After HTTP request");

        let title_selector = scraper::Selector::parse(".entry-title").unwrap();
        let images_selector = scraper::Selector::parse(".entry-content > p > a > img").unwrap();
        let description_selector = Selector::parse("div.entry-content").unwrap();
        let magnetlink_selector = scraper::Selector::parse("a[href*='magnet']").unwrap();

        let title_elem = game_doc.select(&title_selector).next();
        let description_elem = game_doc.select(&description_selector).next();
        let magnetlink_elem = game_doc.select(&magnetlink_selector).next();
        let image_elem = game_doc.select(&images_selector).next();

        let title = title_elem.map(|elem| elem.text().collect::<String>()).unwrap_or_default();
        let description = description_elem.map(|elem| elem.text().collect::<String>()).unwrap_or_default();
        let magnetlink = magnetlink_elem.and_then(|elem| elem.value().attr("href")).unwrap_or_default();
        let image_src = image_elem.and_then(|elem| elem.value().attr("src")).unwrap_or_default();


        let singular_searched_game =  SingularGame {
            title: title.to_string(),
            img: image_src.to_string(),
            desc: description,
            magnetlink: magnetlink.to_string(),
            href: url.to_string()
        };

        searched_game.push(singular_searched_game);
        println!("Execution time: {:#?}", start_time.elapsed());

        let json_data = serde_json::to_string_pretty(&searched_game)?;
        let mut binding = app_handle.path_resolver().app_data_dir().unwrap();

        match Path::new(&binding).exists() {
            true => {
                ()
            }
            false => {
                fs::create_dir_all(&binding)?;
            },
        }
        binding.push("tempGames");
        binding.push("singular_game_temp.json");

        let mut file = File::create(binding).expect("File could not be created !");

        file.write_all(json_data.as_bytes())?;

        let end_time = Instant::now();
        let duration_time_process = end_time - start_time;
        println!("Data has been written to singular_game_temp.json. Time was : {:#?}", duration_time_process);

        Ok(())
    }

}