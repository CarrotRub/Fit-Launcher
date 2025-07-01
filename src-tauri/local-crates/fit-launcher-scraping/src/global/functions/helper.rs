use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use reqwest::header::RANGE;
use scraper::ElementRef;

use crate::structs::Game;

pub fn fetch_game_info(article: ElementRef<'_>) -> Game {
    let title = article
        .select(&scraper::Selector::parse(".entry-title").unwrap())
        .next()
        .map(|e| e.text().collect())
        .unwrap_or_default();

    let desc = article
        .select(&scraper::Selector::parse("div.entry-content").unwrap())
        .next()
        .map(|e| e.text().collect())
        .unwrap_or_default();

    let magnetlink = article
        .select(&scraper::Selector::parse("a[href*='magnet']").unwrap())
        .next()
        .and_then(|e| e.value().attr("href"))
        .map(str::to_string)
        .unwrap_or_default();

    let pastebin = article
        .select(&scraper::Selector::parse("a[href*='.torrent file only']").unwrap())
        .next()
        .and_then(|e| e.value().attr("href"))
        .map(str::to_string)
        .unwrap_or_default();

    let tag = article
        .select(&scraper::Selector::parse(".entry-content p").unwrap())
        .find_map(|p| {
            let text = p.text().collect::<String>();
            if text.trim_start().starts_with("Genres/Tags:") {
                Some(
                    p.select(&scraper::Selector::parse("a:not(:first-child)").unwrap())
                        .map(|a| a.text().collect::<String>())
                        .collect::<Vec<_>>()
                        .join(", "),
                )
            } else {
                None
            }
        })
        .unwrap_or_default();

    let href = article
        .select(&scraper::Selector::parse("span.entry-date > a").unwrap())
        .next()
        .and_then(|e| e.value().attr("href"))
        .map(str::to_string)
        .unwrap_or_default();

    let img = article
        .select(&scraper::Selector::parse(".entry-content > p > a > img").unwrap())
        .next()
        .and_then(|e| e.value().attr("src"))
        .map(str::to_string)
        .unwrap_or_default();

    Game {
        title,
        img,
        desc,
        magnetlink,
        href,
        tag,
        pastebin,
    }
}

pub async fn find_preview_image(article: ElementRef<'_>) -> Option<String> {
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
