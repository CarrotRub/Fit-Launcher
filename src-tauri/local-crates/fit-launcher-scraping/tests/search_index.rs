use fit_launcher_scraping::db::SearchIndexEntry;

#[test]
fn test_search_index_entry_serialization() {
    let entry = SearchIndexEntry {
        slug: "test-game".to_string(),
        title: "Test Game".to_string(),
        href: "https://fitgirl-repacks.site/test-game/".to_string(),
    };

    let json = serde_json::to_string(&entry).unwrap();
    let deserialized: SearchIndexEntry = serde_json::from_str(&json).unwrap();

    assert_eq!(entry.slug, deserialized.slug);
    assert_eq!(entry.title, deserialized.title);
    assert_eq!(entry.href, deserialized.href);
}

#[test]
fn test_sitemap_xml_parsing() {
    use scraper::{Html, Selector};

    // Sample sitemap XML
    let xml_content = r#"
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
                <loc>https://fitgirl-repacks.site/game-one/</loc>
            </url>
            <url>
                <loc>https://fitgirl-repacks.site/game-two/</loc>
            </url>
        </urlset>
    "#;

    let doc = Html::parse_document(xml_content);
    let url_selector = Selector::parse("url").unwrap();
    let loc_selector = Selector::parse("loc").unwrap();

    let mut urls = Vec::new();
    for url_node in doc.select(&url_selector) {
        if let Some(loc_node) = url_node.select(&loc_selector).next() {
            let url_text = loc_node.text().collect::<String>().trim().to_string();
            if !url_text.is_empty() {
                urls.push(url_text);
            }
        }
    }

    assert_eq!(urls.len(), 2);
    assert!(urls.contains(&"https://fitgirl-repacks.site/game-one/".to_string()));
    assert!(urls.contains(&"https://fitgirl-repacks.site/game-two/".to_string()));
}
