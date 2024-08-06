
pub mod basic_scraping {

    use librqbit::Session;
    use serde::{Deserialize, Serialize};
    use core::str;
    use std::error::Error;
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

    #[derive(Debug, Serialize, Deserialize)]
    struct SingleGame {
        my_all_images: Vec<String>,
    }

        #[tokio::main]
    pub async fn scraping_func(app_handle: tauri::AppHandle) -> Result<(), Box<dyn Error>> {
            let start_time = Instant::now();
            let client = Client::new();
            let mut games: Vec<Game> = Vec::new();
        
            // Change the number of pages it will scrap, knowing that there are 10 games per page.
            // Only for recent games.
            for page_number in 1..=2 {
                let url = format!("https://fitgirl-repacks.site/category/lossless-repack/page/{}", page_number);
                let res = client.get(&url).send().await?;
                let body = res.text().await?;
                let document = Html::parse_document(&body);
            
                let titles_selector = Selector::parse(".entry-title a").unwrap();
                let pics_selector = Selector::parse(".alignleft").unwrap();
                let desc_selector = Selector::parse("div.entry-content").unwrap();
                let hreflink_selector = Selector::parse(".entry-title > a").unwrap();
            
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
                        games.push(game);
                    }
                }
            }
            // Serialize the data with pretty formatting
            let json_data = serde_json::to_string_pretty(&games)?;
            let mut binding = app_handle.path_resolver().app_data_dir().unwrap();
        
            binding.push("tempGames");
        
            match Path::new(&binding).exists() {
                true => {
                    ()
                }
                false => {
                    fs::create_dir_all(&binding)?;
                },
            }

            binding.push("newly_added_games.json");
        
            // Write the JSON data to a file named newly_added_games.json inside appdata roaming dir tempGames.
            let mut file = File::create(binding).expect("File could not be created !");
        
            file.write_all(json_data.as_bytes())?;
            let end_time = Instant::now();
            let duration_time_process = end_time - start_time;
            println!("Data has been written to newly_added_games.json. Time was : {:#?}", duration_time_process);
        
            Ok(())
        }
    
        #[tokio::main]
    pub async fn popular_games_scraping_func(app_handle: tauri::AppHandle) -> Result<(), Box<dyn Error>> {
            let start_time = Instant::now();
            let mut popular_games: Vec<Game> = Vec::new();
            
            let client = reqwest::Client::new();
        
            //* Will change back to of the month soon */
            let url = "https://fitgirl-repacks.site/popular-repacks-of-the-year/";
            let res = client.get(url).send().await?;
        
            if !res.status().is_success() {
                // Log the error message instead of returning it
                eprintln!("Error: {:?}", "Failed to connect to the website or the website is down.");
                return Ok(());
            }
        
            let body = res.text().await?;
            let document = scraper::Html::parse_document(&body);
        
            // Handle selector parsing error
            let titles_selector = match scraper::Selector::parse(".widget-grid-view-image > a") {
                Ok(selector) => selector,
                Err(err) => {
                    eprintln!("Error: {:?}", err);
                    return Ok(());
                }
            };
        
            let images_selector = match scraper::Selector::parse(".widget-grid-view-image > a > img") {
                Ok(selector) => selector,
                Err(err) => {
                    eprintln!("Error: {:?}", err);
                    return Ok(());
                }
            };
        
            let description_selector = Selector::parse("div.entry-content").unwrap();
        
            let magnetlink_selector = match scraper::Selector::parse("a[href*='magnet']") {
                Ok(selector) => selector,
                Err(err) => {
                    // Log the error message instead of returning it
                    eprintln!("Error: {:?}", err);
                    return Ok(());
                }
            };
        
            let hreflink_selector = match scraper::Selector::parse(".widget-grid-view-image > a ") {
                Ok(selector) => selector,
                Err(err) => {
                    // Log the error message instead of returning it
                    eprintln!("Error: {:?}", err);
                    return Ok(());
                }
            };
        
        
        
            let mut titles = document.select(&titles_selector);
            let mut images = document.select(&images_selector);
            let mut hreflinks = document.select(&hreflink_selector);
        
            let mut game_count = 0;
            while let (
                Some(title_elem),
                Some(image_elem),
                Some(hreflink_elem),
            ) = (
                titles.next(),
                images.next(),
                hreflinks.next(),
            ) {
                let title = title_elem.value().attr("title");
                let href = hreflink_elem.value().attr("href").unwrap();
            
                // Make a new request to get the description and magnet link
                let game_res = client.get(href).send().await?;
                let game_body = game_res.text().await?;
                let game_doc = scraper::Html::parse_document(&game_body);
            
                // Extract description and magnet link from the new document
                let description_elem = game_doc.select(&description_selector).next();
                let magnetlink_elem = game_doc.select(&magnetlink_selector).next();
            
                let description = description_elem.map(|elem| elem.text().collect::<String>()).unwrap_or_default();
                let magnetlink = magnetlink_elem.and_then(|elem| elem.value().attr("href")).unwrap_or_default();
                let long_image_selector = match scraper::Selector::parse(".entry-content > p:nth-of-type(3) a[href] > img[src]:nth-child(1)") {
                    Ok(selector) => selector,
                    Err(err) => {
                        // Log the error message instead of returning it
                        eprintln!("Error: {:?}", err);
                        return Ok(());
                    }
                };
                
                // Determine the image source based on whether it's the first game or not
                let image_src = if game_count == 0 {
                    let mut p_index = 3;
                    // For the first game, use long_image_selector
                    let mut long_image_elem = game_doc.select(&long_image_selector).next();
                    while long_image_elem.is_none() && p_index < 10 {
                        p_index += 1;
                        println!("yo {}",p_index);
                        // Update the selector to try the next element
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
                    // For subsequent games, use images_selector
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
            
            println!("Execution time: {:?}", start_time.elapsed());
            let json_data = serde_json::to_string_pretty(&popular_games)?;
            let mut binding = app_handle.path_resolver().app_data_dir().unwrap();
            
            binding.push("tempGames");
        
            match Path::new(&binding).exists() {
                true => {
                    ()
                }
                false => {
                    fs::create_dir_all(&binding)?;
                },
            }
            
            binding.push("popular_games.json");
        
            // Write the JSON data to a file named popular_games.json inside appdata roaming dir tempGames.
            let mut file = File::create(binding).expect("File could not be created !");
        
            file.write_all(json_data.as_bytes())?;
            let end_time = Instant::now() ;
            let duration_time_process = end_time - start_time;
            println!("Data has been written to popular_games.json. Time was : {:#?}", duration_time_process);
            Ok(())
        }
        
    #[tokio::main]
    pub async fn recently_updated_games_scraping_func(app_handle: tauri::AppHandle) -> Result<(), Box<dyn Error>> {

        println!("Before HTTP request");
        let start_time = Instant::now();
        let mut recent_games: Vec<Game> = Vec::new();

        let client = reqwest::Client::new();

        let url = "https://fitgirl-repacks.site/category/updates-digest/";
        let res = client.get(url).send().await?;

        println!("After HTTP request");
        if !res.status().is_success() {
            eprintln!("Error: Failed to connect to the website or the website is down.");
            return Ok(());
        }

        let body = res.text().await?;
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
            let href = hreflink_elem.value().attr("href").unwrap();

            let game_res = client.get(href).send().await?;
        
            let game_body = game_res.text().await?;
        
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

        println!("Execution time: {:?}", start_time.elapsed());
        let json_data = serde_json::to_string_pretty(&recent_games)?;
        let mut binding = app_handle.path_resolver().app_data_dir().unwrap();

        binding.push("tempGames");

        match Path::new(&binding).exists() {
            true => {
                ()
            }
            false => {
                fs::create_dir_all(&binding)?;
            },
        }

        binding.push("recently_updated_games.json");

        // Write the JSON data to a file named recently_updated_games.json inside appdata roaming dir tempGames.
        let mut file = File::create(binding).expect("File could not be created !");

        file.write_all(json_data.as_bytes())?;
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
        println!("Execution time: {:?}", start_time.elapsed());

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