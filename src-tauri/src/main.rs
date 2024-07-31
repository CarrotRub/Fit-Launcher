// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// TODO: Divide and structure the project.
// TODO: Better caching.
// ! TODO: USE PATHRESOLVER FOR BUNDLING.

use core::str;
use std::error::Error;
use std::fs;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::fs::File;
use std::io::Write;
use std::io::Read;
use std::fmt;
use std::thread;
use tauri::{Manager, Window};
use tauri::async_runtime::spawn;
use std::time::{Duration, Instant};
use tokio::time::timeout;
use std::path::PathBuf;
// use serde_json::json;
use std::path::Path;
// crates for requests
use reqwest;
use kuchiki::traits::*;
use anyhow::{Result, Context};
// stop threads
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
// caching
use std::num::NonZeroUsize;
use lru::LruCache;
use tokio::sync::Mutex;
use tauri::State;
// torrenting
use librqbit::{AddTorrent, AddTorrentOptions, AddTorrentResponse, Session, TorrentStatsState, SessionOptions};
use tauri::async_runtime;
use tracing::info;
use lazy_static::lazy_static;
use tauri::PathResolver;

lazy_static! {
    static ref SESSION: Mutex<Option<Arc<Session>>> = Mutex::new(None);
}

// Define a shared boolean flag
static STOP_FLAG: AtomicBool = AtomicBool::new(false);
static STOP_FLAG_TORRENT: AtomicBool = AtomicBool::new(false);
static PAUSE_FLAG: AtomicBool = AtomicBool::new(false);




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
async fn scraping_func() -> Result<(), Box<dyn Error>> {
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

    // Write the JSON data to a file named games.json
    let mut file = File::create("../src/temp/newly_added_games.json")?;
    file.write_all(json_data.as_bytes())?;
    let end_time = Instant::now();
    let duration_time_process = end_time - start_time;
    println!("Data has been written to newly_added_games.json. Time was : {:#?}", duration_time_process);

    Ok(())
}

#[tokio::main]
async fn popular_games_scraping_func() -> Result<(), Box<dyn Error>> {
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

    // Write the JSON data to a file named games.json
    let mut file = File::create("../src/temp/popular_games.json")?;
    file.write_all(json_data.as_bytes())?;
    let end_time = Instant::now() ;
    let duration_time_process = end_time - start_time;
    println!("Data has been written to popular_games.json. Time was : {:#?}", duration_time_process);
    Ok(())
}



#[derive(Debug, Serialize)] // Derive Serialize trait for your custom error type
struct MyCustomError {
    message: String,
    // Other fields as needed
}

impl std::fmt::Display for MyCustomError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl Error for MyCustomError {}


#[derive(Debug)]
struct SelectError;

impl std::fmt::Display for SelectError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "HTML selection error")
    }
}

impl std::error::Error for SelectError {}


#[derive(Debug, Serialize, Deserialize)]
struct GameImages {
    my_all_images: Vec<String>,
}

#[derive(Debug, Serialize)]
struct SingularFetchError {
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
async fn recently_updated_games_scraping_func() -> Result<(), Box<dyn Error>> {
    
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

    let mut file = File::create("../src/temp/recently_updated_games.json")?;
    file.write_all(json_data.as_bytes())?;
    let end_time = Instant::now();
    let duration_time_process = end_time - start_time;
    println!("Data has been written to recently_updated_games.json. Time was : {:#?}", duration_time_process);

    Ok(())
}




async fn download_sitemap(url: &str, filename: &str) -> Result<(), Box<dyn Error>> {

    let client = reqwest::Client::new();

    let mut response = client.get(url).send().await?;

    // Get the current directory
    let current_dir = std::env::current_dir()?;
    let relative_path = Path::new("../src/temp/sitemaps/");
    
    // Create the full file path by joining current directory, relative path, and filename
    let file_path = current_dir
        .join(&relative_path)
        .join(format!("{}.xml", filename));    // Ensure the parent directories exist, creating them if necessary
    
    if let Some(parent_dir) = file_path.parent() {
        fs::create_dir_all(parent_dir).unwrap();
    }

    // Open a file at the specified path for writing
    let mut file = fs::File::create(&file_path).unwrap();
    
    // Asynchronously copy the response body to the file
    while let Some(chunk) = response.chunk().await? {
        file.write_all(&chunk).unwrap();
    }

    Ok(())
}

#[tokio::main]
async fn get_sitemaps_website() -> Result<(), Box<dyn Error>> {

    println!("Before Sitemaps Request");

    for page_number in 1..=5 {

        let sitemap_number: Option<i32> = if page_number == 0 {
            None
        } else {
            Some(page_number)
        };

        let relative_url = if let Some(num) = sitemap_number {
            format!("https://fitgirl-repacks.site/post-sitemap{}.xml", num)
        } else {
            "https://fitgirl-repacks.site/post-sitemap/".to_string()
        };


        let relative_filename = format!("post-sitemap{}", if let Some(num) = sitemap_number {
            num.to_string()
        } else {
            "".to_string()
        });

        println!("relative url :  {}. relative filename: {}", relative_url, relative_filename);
        download_sitemap(&relative_url, &relative_filename).await?;


    }


    Ok(())
}


fn extract_hrefs_from_body(body: &str) -> Result<Vec<String>> {
    let document = kuchiki::parse_html().one(body);
    let mut hrefs = Vec::new();
    let mut p_index = 3;

    while p_index < 10 {
        let href_selector_str = format!(".entry-content > p:nth-of-type({}) a[href]", p_index);

        for anchor_elem in document
            .select(&href_selector_str)
            .map_err(|_| anyhow::anyhow!("Failed to select anchor element"))?
        {
            if let Some(href_link) = anchor_elem.attributes.borrow().get("href") {
                hrefs.push(href_link.to_string());
            }
        }

        p_index += 1;
    }

    Ok(hrefs)
}

async fn fetch_and_process_href(client: &Client, href: &str) -> Result<Vec<String>> {
    let processing_time = Instant::now();

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let mut image_srcs = Vec::new();
    let image_selector = "div.big-image > a > img";
    let noscript_selector = "noscript";
    println!("Start getting images process");

    let href_res = client
        .get(href)
        .send()
        .await
        .context("Failed to send HTTP request to HREF")?;
    if !href_res.status().is_success() {
        return Ok(image_srcs);
    }

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let href_body = href_res.text().await.context("Failed to read HREF response body")?;
    let href_document = kuchiki::parse_html().one(href_body);

    println!("Start getting text process");

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    for noscript in href_document
        .select(noscript_selector)
        .map_err(|_| anyhow::anyhow!("Failed to select noscript element"))?
    {
        let inner_noscript_html = noscript.text_contents();
        let inner_noscript_document = kuchiki::parse_html().one(inner_noscript_html);

        for img_elem in inner_noscript_document
            .select(image_selector)
            .map_err(|_| anyhow::anyhow!("Failed to select image element"))?
        {
            if let Some(src) = img_elem.attributes.borrow().get("src") {
                image_srcs.push(src.to_string());
            }
        }

        // Check if the processing time exceeds 4 seconds
        if processing_time.elapsed() > Duration::new(4, 0) {
            println!("Processing time exceeded 4 seconds, returning collected images so far");
            return Ok(image_srcs);
        }
    }

    Ok(image_srcs)
}

async fn scrape_image_srcs(url: &str) -> Result<Vec<String>> {
    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(anyhow::anyhow!("Cancelled the Event..."));
    }

    let client = Client::new();
    let res = client
        .get(url)
        .send()
        .await
        .context("Failed to send HTTP request")?;

    if !res.status().is_success() {
        return Err(anyhow::anyhow!("Failed to connect to the website or the website is down."));
    }

    let body = res.text().await.context("Failed to read response body")?;
    println!("Start extracting hrefs");
    let hrefs = extract_hrefs_from_body(&body)?;

    let mut image_srcs = Vec::new();

    for href in hrefs {
        println!("Start fetching process");
        let result = timeout(Duration::new(4, 0), fetch_and_process_href(&client, &href)).await;
        match result {
            Ok(Ok(images)) => {
                if !images.is_empty() {
                    image_srcs.extend(images);
                }
            },
            Ok(Err(e)) => println!("Error fetching images from href: {}", e),
            Err(_) => println!("Timeout occurred while fetching images from href"),
        }
    }

    Ok(image_srcs)
}

// Cache with a capacity of 100
type ImageCache = Arc<Mutex<LruCache<String, Vec<String>>>>;

#[tauri::command]
async fn stop_get_games_images() {
    STOP_FLAG.store(true, Ordering::Relaxed);
}

#[tauri::command]
async fn get_games_images(game_link: String, image_cache: State<'_, ImageCache>) -> Result<(), CustomError> {
    STOP_FLAG.store(false, Ordering::Relaxed);
    let start_time = Instant::now();

    let mut cache = image_cache.lock().await;

    if let Some(cached_images) = cache.get(&game_link) {
        println!("Cache hit! Returning cached images.");
        let game = GameImages { my_all_images: cached_images.clone() };
        let json_data = serde_json::to_string_pretty(&game).context("Failed to serialize image sources to JSON")
            .map_err(|e| CustomError { message: e.to_string() })?;
        fs::write("../src/temp/singular_games.json", json_data).context("Failed to write JSON data to file")
            .map_err(|e| CustomError { message: e.to_string() })?;

        return Ok(());
    }

    drop(cache); // Release the lock before making network requests

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(CustomError { message: "Function stopped.".to_string() });
    }

    let image_srcs = scrape_image_srcs(&game_link).await.map_err(|e| CustomError { message: e.to_string() })?;

    // Ensure that at least one image URL is included, even if no images were found
    let game = GameImages { my_all_images: image_srcs.clone() };
    let json_data = serde_json::to_string_pretty(&game).context("Failed to serialize image sources to JSON")
        .map_err(|e| CustomError { message: e.to_string() })?;
    fs::write("../src/temp/singular_games.json", json_data).context("Failed to write JSON data to file")
        .map_err(|e| CustomError { message: e.to_string() })?;

    if STOP_FLAG.load(Ordering::Relaxed) {
        return Err(CustomError { message: "Function stopped.".to_string() });
    }

    let end_time = Instant::now();
    let duration = end_time.duration_since(start_time);
    println!("Data has been written to single_games.json. Time was: {:?}", duration);

    // Update the cache
    let mut cache = image_cache.lock().await;
    cache.put(game_link, image_srcs);

    Ok(())
}

//Always serialize returns...
#[derive(Debug, Serialize, Deserialize)]
struct FileContent {
    content: String
}

#[derive(Debug, Serialize)]
struct CustomError {
    message: String,
}

impl fmt::Display for CustomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl Error for CustomError {}

impl From<Box<dyn Error>> for CustomError {
    fn from(error: Box<dyn Error>) -> Self {
        CustomError {
            message: error.to_string(),
        }
    }
}



#[tauri::command(async)]
async fn read_file(file_path: String) -> Result<FileContent, CustomError> {
    let mut file = File::open(&file_path)
        .map_err(|e| CustomError { message: e.to_string() })?;
    let mut data_content = String::new();
    file.read_to_string(&mut data_content)
        .map_err(|e| CustomError { message: e.to_string() })?;

    Ok(FileContent { content: data_content })
}


#[tauri::command]
async fn clear_file(file_path: String) -> Result<(), CustomError> {
    let path = Path::new(&file_path);

    // Attempt to create the file, truncating if it already exists
    File::create(&path).map_err(|err| CustomError{ message: err.to_string()})?;
    
    Ok(())
}


#[tauri::command]
async fn close_splashscreen(window: Window) {
  // Close splashscreen
  window.get_window("splashscreen").expect("no window labeled 'splashscreen' found").close().unwrap();
  // Show main window
  window.get_window("main").expect("no window labeled 'main' found").show().unwrap();
}


#[tauri::command]
fn check_folder_path(path: String) -> Result<bool, bool> {
    let path_obj = PathBuf::from(&path);
    
    // Debugging information
    println!("Checking path: {:?}", path_obj);
    
    if !path_obj.exists() {
        println!("Path does not exist.");
        return Ok(false);
    }
    if !path_obj.is_dir() {
        println!("Path is not a directory.");
        return Ok(false);
    }
    println!("Path is valid.");
    Ok(true)
}





// * Creating a special TorrentError that will just be an impl of anyhow basic string error.
#[derive(Debug, Serialize)]
struct TorrentError {
    message: String,
}

impl fmt::Display for TorrentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for TorrentError {}

impl From<anyhow::Error> for TorrentError {
    fn from(error: anyhow::Error) -> Self {
        TorrentError {
            message: error.to_string(),
        }
    }
}


// Creation of a struct containing every useful infomartion that will be used later on in the FrontEnd.
#[derive(Debug, Clone, Serialize)]
struct TorrentStatsInformations{
    state: TorrentStatsState,
    file_progress: Vec<u64>,
    error: Option<String>,
    progress_bytes: u64,
    uploaded_bytes: u64,
    total_bytes: u64,
    finished: bool,
    download_speed: Option<f64>,
    upload_speed: Option<f64>,
    average_piece_download_time: Option<f64>,
    // * Not the best way to implement the time remaining, but for now this will do the job.
    time_remaining: Option<std::string::String>,
}

impl Default for TorrentStatsInformations {
    fn default() -> Self {
        Self {
            state: TorrentStatsState::Paused, // Starting as Paused if null just because it is the base state.
            file_progress: vec![], // The progress for every file that is downloading.
            error: None,
            progress_bytes: 0,
            uploaded_bytes: 0,
            total_bytes: 0,
            finished: false,
            download_speed: None,
            upload_speed: None,
            average_piece_download_time: None,
            time_remaining: None,
        }
    }
}

async fn start_torrent_thread(
    magnet_link: String,
    torrent_stats: Arc<Mutex<TorrentStatsInformations>>,
    download_path: String
) -> Result<(), anyhow::Error> {
    let output_dir: String = download_path;
    // let persistence_filename = format!("{}/.session_persistence.json", output_dir);
    let mut session = SESSION.lock().await;

    

    // Check if a session already exists by looking at the lazy_static
    if session.is_none() {
        // Define and initialize the SessionOptions struct
        let mut custom_session_options = SessionOptions::default();

        // Customize the options you want to change
        custom_session_options.disable_dht = false;
        custom_session_options.disable_dht_persistence = false;
        custom_session_options.persistence = false;
        // custom_session_options.persistence_filename = Some(PathBuf::from(persistence_filename.clone()));
        custom_session_options.enable_upnp_port_forwarding = true;

        // Create a new session with the specified options
        let new_session: Arc<Session> = Session::new_with_opts(
            output_dir.into(),
            custom_session_options
        )
        .await
        .context("error creating session")?;

        *session = Some(new_session);
    }

    let session = session.clone().unwrap();
    

    // let managed_torrents_list = session.with_torrents( callback);

    let handle = match session
    .add_torrent(
        AddTorrent::from_url(&magnet_link),
        Some(AddTorrentOptions {
            overwrite: true,
            disable_trackers: false, // * Not sure about this one, not the best but better for greater optimization. Prevent useless dead trackers.
            
            ..Default::default()
        }),
    )
    .await
    .context("error adding torrent")?
    {
        AddTorrentResponse::Added(_, handle) => handle,
        _ => unreachable!(),
    };
    info!("Details: {:?}", &handle.info().info);



    {
        let handle = handle.clone();
        let torrent_stats = Arc::clone(&torrent_stats);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(1)).await;
                let stats = handle.stats();
                let mut torrent_stats = torrent_stats.lock().await;

                // Just copying stats from the handler to the Structure.
                torrent_stats.state = stats.state.clone();
                torrent_stats.file_progress = stats.file_progress.clone();
                torrent_stats.error = stats.error.clone();
                torrent_stats.progress_bytes = stats.progress_bytes;
                torrent_stats.uploaded_bytes = stats.uploaded_bytes;
                torrent_stats.total_bytes = stats.total_bytes;
                torrent_stats.finished = stats.finished;


                if let Some(live_stats) = stats.live {

                    torrent_stats.download_speed = Some(live_stats.download_speed.mbps as f64);
                    torrent_stats.upload_speed = Some(live_stats.upload_speed.mbps as f64);

                    torrent_stats.average_piece_download_time = live_stats
                        .average_piece_download_time
                        .map(|d| d.as_secs_f64());

                    // Gets it directly as a string because I stupidly decided to not use the API.
                    // I also actually forgot why exactly I couldn't use the impl/struct, probably because it was private though.
                    torrent_stats.time_remaining = live_stats
                    .time_remaining
                    .map(|d|d.to_string() );

                    if torrent_stats.finished {
                        stop_torrent_function(session.clone()).await;
                        break; // Exit the loop if finished
                    }

                    if STOP_FLAG_TORRENT.load(Ordering::Relaxed) {
                        stop_torrent_function(session.clone()).await;
                        break; // Exit the loop if finished
                    }
                        
                    if PAUSE_FLAG.load(Ordering::Relaxed) {
                        pause_torrent_function(torrent_stats.to_owned()).await;
                        break; // Exit the loop if finished
                    }

                } else {
                    torrent_stats.download_speed = None;
                    torrent_stats.upload_speed = None;
                    torrent_stats.average_piece_download_time = None;
                    torrent_stats.time_remaining = None;
                }

                info!("{:?}", *torrent_stats);
            }
        });
    }

    handle.wait_until_completed().await?;
    info!("torrent downloaded");

    Ok(())
}

#[derive(Default)]
struct TorrentState {
    stats: Arc<Mutex<TorrentStatsInformations>>,
}

#[tauri::command]
async fn start_torrent_command(
    magnet_link: String,
    download_path: String,
    torrent_state: State<'_, TorrentState>,
) -> Result<(), String> {
    let torrent_stats: Arc<Mutex<TorrentStatsInformations>> = Arc::clone(&torrent_state.stats);
    spawn(async move {
        println!("{} , {}",magnet_link, download_path);
        if let Err(e) = start_torrent_thread(magnet_link, torrent_stats, download_path).await {
            eprintln!("Error in torrent thread: {:?}", e);
        }
    });
    Ok(())
}

#[tauri::command]
async fn get_torrent_stats(torrent_state: State<'_, TorrentState>) -> Result<TorrentStatsInformations, TorrentError> {
    let torrent_stats: tokio::sync::MutexGuard<TorrentStatsInformations> = torrent_state.stats.lock().await;
    println!("Current torrent stats: {:?}", *torrent_stats);
    Ok(torrent_stats.clone())
}


async fn stop_torrent_function(session_id: Arc<Session>){
    session_id.stop().await;
}

#[tauri::command]
async fn stop_torrent_command() -> Result<(), CustomError> {
    // Set the global stop flag
    STOP_FLAG.store(true, Ordering::Relaxed);
    Ok(())
}

// New pause_torrent_function
async fn pause_torrent_function(torrent_stats: TorrentStatsInformations) {
    // let torrent_stats: Arc<Mutex<TorrentStatsInformations>> = Arc::clone(&torrent_state.stats);
    let mut stats = torrent_stats;

    // Update the state to paused
    stats.state = TorrentStatsState::Paused;


}

#[tauri::command]
async fn pause_torrent_command() -> Result<(), CustomError> {
    // Set the global pause flag
    PAUSE_FLAG.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
async fn resume_torrent_command() -> Result<(), CustomError> {
    // Set the global pause flag
    PAUSE_FLAG.store(false, Ordering::Relaxed);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct SingularGame {
    title: String,
    img: String,
    desc: String,
    magnetlink: String,
    href: String
}

#[tauri::command]
async fn get_singular_game_info(app_handle: tauri::AppHandle, game_link: String) -> Result<(), SingularFetchError> {

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
    let binding = app_handle.path_resolver().app_data_dir().unwrap();
    let app_data_dir = binding.to_str().unwrap();
    
    let app_data_dir = app_data_dir.to_string();
    let filepath = format!( "{}/singular_game_temp.json", app_data_dir);
    let mut file = File::create(filepath)?;
    file.write_all(json_data.as_bytes())?;
    let end_time = Instant::now();
    let duration_time_process = end_time - start_time;
    println!("Data has been written to singular_game_temp.json. Time was : {:#?}", duration_time_process);

    Ok(())
}



fn main() -> Result<(), Box<dyn Error>> {
    let image_cache = Arc::new(Mutex::new(LruCache::<String, Vec<String>>::new(NonZeroUsize::new(30).unwrap())));
    let torrent_state = TorrentState::default();
    // let closing_signal_received = Arc::new(AtomicBool::new(false));


    tauri::Builder::default()
        .setup(move |_app| {
            // Create a thread for the first function
            let handle1 = thread::Builder::new().name("scraping_func".into()).spawn(|| {
                if let Err(e) = scraping_func() {
                    eprintln!("Error in scraping_func: {}", e);
                    std::process::exit(1);
                }
            }).expect("Failed to spawn thread for scraping_func");

            // Create a thread for the second function
            let handle2 = thread::Builder::new().name("popular_and_recent_games_scraping_func".into()).spawn(|| {
                if let Err(e) = popular_games_scraping_func() {    
                    eprintln!("Error in popular_games_scraping_func: {}", e);
                    std::process::exit(1);
                }

                if let Err(e) = get_sitemaps_website() {
                    eprintln!("Error in get_sitemaps_website: {}", e);
                    std::process::exit(1);
                }

                if let Err(e) = recently_updated_games_scraping_func() {
                    eprintln!("Error in recently_updated_games_scraping_func: {}", e);
                    std::process::exit(1);
                }
            }).expect("Failed to spawn thread for popular_games_scraping_func");

            // Wait for both threads to finish
            async_runtime::spawn(async move {
                handle1.join().expect("Thread 1 panicked");
                handle2.join().expect("Thread 2 panicked");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            close_splashscreen,
            get_games_images,
            clear_file,
            stop_get_games_images,
            check_folder_path,
            start_torrent_command,
            get_torrent_stats,
            stop_torrent_command,
            pause_torrent_command,
            resume_torrent_command,
            get_singular_game_info
        ])
        .manage(image_cache) // Make the cache available to commands 
        .manage(torrent_state) 
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| match event {
          tauri::RunEvent::ExitRequested { .. } => {
            
            PAUSE_FLAG.store(true, Ordering::Relaxed);
          }
          _ => {}
        });
    Ok(())
}