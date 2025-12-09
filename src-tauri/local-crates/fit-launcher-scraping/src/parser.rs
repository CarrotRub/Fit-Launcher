//! HTML parsing helpers for extracting game data from FitGirl pages.

use scraper::ElementRef;

use crate::structs::Game;

/// Extract game details (genres/tags, companies, languages, sizes)
fn extract_details(article: ElementRef<'_>) -> String {
    let mut details_lines = Vec::new();
    let p_selector = scraper::Selector::parse(".entry-content p").unwrap();

    for p in article.select(&p_selector) {
        let text = p.text().collect::<String>();
        let trimmed = text.trim();

        if trimmed.starts_with("Genres/Tags:")
            || trimmed.starts_with("Companies:")
            || trimmed.starts_with("Company:")
            || trimmed.starts_with("Languages:")
            || trimmed.starts_with("Language:")
            || trimmed.starts_with("Original Size:")
            || trimmed.starts_with("Repack Size:")
        {
            details_lines.push(trimmed.to_string());
        }

        if trimmed.contains("Download Mirrors") {
            break;
        }
    }

    details_lines.join("\n")
}

/// Extract repack features section
fn extract_features(article: ElementRef<'_>) -> String {
    let mut in_features = false;
    let mut features_lines = Vec::new();
    let p_selector = scraper::Selector::parse(".entry-content p, .entry-content ul li").unwrap();

    for elem in article.select(&p_selector) {
        let text = elem.text().collect::<String>();
        let trimmed = text.trim();

        if trimmed.contains("Repack Features") || trimmed.starts_with("Based on ") {
            in_features = true;
        }

        if trimmed.contains("Game Description") || trimmed.contains("Game Features") {
            break;
        }

        if in_features && !trimmed.is_empty() && !trimmed.contains("Repack Features") {
            features_lines.push(trimmed.to_string());
        }
    }

    features_lines.join("\n")
}

/// Extract game description, gameplay features, and included DLCs
fn extract_description_and_dlcs(article: ElementRef<'_>) -> (String, String, String) {
    let spoiler_selector = scraper::Selector::parse(".su-spoiler").unwrap();

    for spoiler in article.select(&spoiler_selector) {
        let title_selector = scraper::Selector::parse(".su-spoiler-title").unwrap();
        if let Some(title) = spoiler.select(&title_selector).next() {
            let title_text = title.text().collect::<String>();
            if title_text.trim().contains("Game Description") {
                let content_selector = scraper::Selector::parse(".su-spoiler-content").unwrap();
                if let Some(content) = spoiler.select(&content_selector).next() {
                    let full_text = content.text().collect::<String>().trim().to_string();

                    let mut description = full_text.clone();
                    let mut gameplay_features = String::new();
                    let mut included_dlcs = String::new();

                    // Find explicit "Game Features"
                    let features_keyword = "Game Features";
                    // Find explicit "Included DLCs"
                    let dlcs_keyword = "Included DLCs";

                    let features_idx = description.find(features_keyword);
                    let dlcs_idx = description.find(dlcs_keyword);

                    match (features_idx, dlcs_idx) {
                        (Some(f_idx), Some(d_idx)) => {
                            if f_idx < d_idx {
                                // Features first, then DLCs
                                gameplay_features = description
                                    [f_idx + features_keyword.len()..d_idx]
                                    .trim()
                                    .trim_start_matches(':')
                                    .trim()
                                    .to_string();
                                included_dlcs = description[d_idx + dlcs_keyword.len()..]
                                    .trim()
                                    .trim_start_matches(':')
                                    .trim()
                                    .to_string();
                                description = description[..f_idx].trim().to_string();
                            } else {
                                // DLCs first (unusual), then Features
                                included_dlcs = description[d_idx + dlcs_keyword.len()..f_idx]
                                    .trim()
                                    .trim_start_matches(':')
                                    .trim()
                                    .to_string();
                                gameplay_features = description[f_idx + features_keyword.len()..]
                                    .trim()
                                    .trim_start_matches(':')
                                    .trim()
                                    .to_string();
                                description = description[..d_idx].trim().to_string();
                            }
                        }
                        (Some(f_idx), None) => {
                            // Only features
                            gameplay_features = description[f_idx + features_keyword.len()..]
                                .trim()
                                .trim_start_matches(':')
                                .trim()
                                .to_string();
                            description = description[..f_idx].trim().to_string();
                        }
                        (None, Some(d_idx)) => {
                            // Only DLCs
                            included_dlcs = description[d_idx + dlcs_keyword.len()..]
                                .trim()
                                .trim_start_matches(':')
                                .trim()
                                .to_string();
                            description = description[..d_idx].trim().to_string();
                        }
                        (None, None) => {
                            // Neither
                        }
                    }

                    return (description, gameplay_features, included_dlcs);
                }
            }
        }
    }

    (String::new(), String::new(), String::new())
}

/// Parse an article element into a Game struct
pub fn parse_game_from_article(article: ElementRef<'_>) -> Game {
    let title = article
        .select(&scraper::Selector::parse(".entry-title").unwrap())
        .next()
        .map(|e| e.text().collect())
        .unwrap_or_default();

    let details = extract_details(article);
    let features = extract_features(article);
    let (description, gameplay_features, included_dlcs) = extract_description_and_dlcs(article);

    let magnetlink = article
        .select(&scraper::Selector::parse("a[href*='magnet']").unwrap())
        .next()
        .and_then(|e| e.value().attr("href"))
        .map(str::to_string)
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

    Game {
        title,
        img,
        details,
        features,
        description,
        gameplay_features,
        included_dlcs,
        magnetlink,
        href,
        tag,
        secondary_images: Vec::new(),
    }
}

/// Find a preview image in the article (for popular games)
pub fn find_preview_image(article: ElementRef<'_>) -> Option<String> {
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

/// Extract secondary images from an article (for discovery games)
pub fn extract_secondary_images(article: ElementRef<'_>) -> Vec<String> {
    let mut secondary = Vec::new();

    for p in 3..=5 {
        let sel =
            scraper::Selector::parse(&format!(".entry-content > p:nth-of-type({p}) img[src]"))
                .unwrap();
        for img_el in article.select(&sel) {
            if let Some(s) = img_el.value().attr("src") {
                secondary.push(s.to_string());
                if secondary.len() == 5 {
                    return secondary;
                }
            }
        }
    }

    secondary
}
