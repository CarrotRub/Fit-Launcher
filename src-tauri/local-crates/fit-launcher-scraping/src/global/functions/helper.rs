use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use reqwest::header::RANGE;
use scraper::ElementRef;

pub async fn find_preview_image<'a>(article: ElementRef<'a>) -> Option<String> {
    for i in 3..10 {
        let selector = match scraper::Selector::parse(&format!(
            ".entry-content > p:nth-of-type({i}) a[href] > img[src]:nth-child(1)"
        )) {
            Ok(sel) => sel,
            Err(_) => continue,
        };

        let Some(src) = article
            .select(&selector)
            .next()
            .and_then(|element| element.value().attr("src"))
        else {
            continue;
        };

        let final_url = if src.contains("240p") {
            let hi_res = src.replace("240p", "1080p");
            if check_url_status(&hi_res).await {
                hi_res
            } else {
                src.replace("jpg.1080p.", "")
            }
        } else {
            src.to_string()
        };
        return Some(final_url);
    }

    None
}

async fn check_url_status(url: &str) -> bool {
    CUSTOM_DNS_CLIENT
        .head(url)
        .header(RANGE, "bytes=0-8")
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}
