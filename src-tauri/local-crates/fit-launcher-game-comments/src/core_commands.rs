use crate::types::Comments;
use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE};

pub async fn fetch_comments(game_url: &str) -> Result<Comments, String> {
    let client_guard = CUSTOM_DNS_CLIENT.read().await;
    let client = &*client_guard;

    let api_url = "https://web.tolstoycomments.com/api/chatpage/first";

    let response = client
        .get(api_url)
        .query(&[
            ("siteid", "6289"),
            ("hash", "null"),
            ("url", game_url),
            ("sort", "1"),
            ("format", "1"),
        ])
        .header(ACCEPT, "*/*")
        .header(ACCEPT_LANGUAGE, "en-US,en;q=0.5")
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned status: {}", response.status()));
    }

    let decoded = response
        .json::<Comments>()
        .await
        .map_err(|e| format!("Failed to parse comment data: {}", e))?;

    Ok(decoded)
}
