pub mod downloads_function {
    use anyhow::Result;
    use tracing::{error, info};

    use crate::{basic_scraping::ScrapingError, CUSTOM_DNS_CLIENT};

    #[derive(Debug)]
    struct GameInfoLinks {
        href: String,
        download_links: Vec<String>,
    }

    impl GameInfoLinks {
        fn default(&self) -> Self {
            GameInfoLinks {
                href: "".to_string(),
                download_links: Vec::new(),
            }
        }
    }

    #[tokio::main]
    async fn get_links_list(link_to_paste: String) -> Result<Vec<String>, Box<ScrapingError>> {
        let response = CUSTOM_DNS_CLIENT
            .get(&link_to_paste)
            .send()
            .await
            .map_err(|e| {
                error!("Failed to get response from URL: {}", &link_to_paste);
                error!("Error is: {}", e);
                ScrapingError::ReqwestError(e)
            })
            .expect("Error getting response from URL, please check the logs.");

        if !response.status().is_success() {
            error!(
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
                eprintln!("Failed to get a body from URL: {}", &link_to_paste);
                ScrapingError::ReqwestError(e)
            })
            .unwrap();

        let html_document = scraper::Html::parse_document(&body);

        let files_links_selector = scraper::Selector::parse("#plaintext > ul > li > a")
            .map_err(|err| ScrapingError::SelectorError(err.to_string()))
            .expect("Error selecting data nodes link");
        let links: Vec<String> = html_document
            .select(&files_links_selector) // Select matching elements
            .filter_map(|element| element.value().attr("href").map(String::from)) // Extract and convert href attributes
            .collect();

        Ok(links)
    }

    #[tauri::command]
    pub async fn get_fucking_fast_file_links(
        url: String,
    ) -> Result<Vec<String>, Box<ScrapingError>> {
        let response = CUSTOM_DNS_CLIENT
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                error!("Failed to get response from URL: {}", &url);
                error!("Error is: {}", e);
                ScrapingError::ReqwestError(e)
            })
            .expect("Error getting response from URL, please check the logs.");

        if !response.status().is_success() {
            error!(
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

        let data_nodes_link_selector = scraper::Selector::parse(".entry-content > ul > li > a")
            .map_err(|err| ScrapingError::SelectorError(err.to_string()))
            .expect("Error selecting data nodes link");

        let mut nodes_data_links: Vec<String> = Vec::new();

        for element in html_document.select(&data_nodes_link_selector) {
            // Collect the text content of the element
            let text_content = element.text().collect::<Vec<_>>().concat();
            if text_content.contains("FuckingFast") {
                if let Some(href) = element.value().attr("href") {
                    info!("Found href with text 'FuckingFast': {}", &href);
                    // Process the href using get_links_list
                    nodes_data_links = get_links_list(href.to_string()).unwrap_or_default();
                }
            }
        }

        Ok(nodes_data_links)
    }

    #[tauri::command]
    pub async fn start_data_nodes_downloading() {}
}
