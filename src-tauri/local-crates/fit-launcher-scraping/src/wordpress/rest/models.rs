use serde::Deserialize;
use specta::Type;

#[derive(Debug, Deserialize, Default, Type)]
pub struct WpRendered {
    #[serde(default)]
    pub rendered: String,

    #[serde(default)]
    pub protected: bool,
}

#[derive(Debug, Deserialize, Type)]
pub struct WpPost {
    pub id: u64,

    #[serde(default)]
    pub slug: String,

    #[serde(default)]
    pub link: String,

    #[serde(default)]
    pub title: WpRendered,

    #[serde(default)]
    pub content: WpRendered,

    #[serde(default)]
    pub excerpt: WpRendered,

    #[serde(default)]
    pub date_gmt: String,
}
