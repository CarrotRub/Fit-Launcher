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
        .select(
            &scraper::Selector::parse(
                "a[href*='pastefg.hermietkreeft.site'], a[href*='paste.fitgirl-repacks.site']",
            )
            .unwrap(),
        )
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

pub fn find_preview_image(article: scraper::element_ref::ElementRef<'_>) -> Option<String> {
    for i in 3..10 {
        let selector = match scraper::Selector::parse(&format!(
            ".entry-content > p:nth-of-type({i}) a[href] > img[src]:nth-child(1)"
        )) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if let Some(img_el) = article.select(&selector).next() {
            if let Some(src) = img_el.value().attr("src") {
                return Some(src.to_string());
            }
        }
    }

    if let Some(img_el) = article
        .select(&scraper::Selector::parse(".entry-content img").unwrap())
        .next()
    {
        if let Some(src) = img_el.value().attr("src") {
            return Some(src.to_string());
        }
    }

    None
}
