use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Default, Debug, Serialize, Deserialize, Type, Clone)]
#[serde(default)]
pub struct Game {
    pub title: String,
    pub img: String,
    pub desc: String,
    pub magnetlink: String,
    pub href: String,
    pub tag: String,
    pub pastebin: String,
}

#[derive(Default, Debug, Deserialize, Serialize, Clone, Type)]
#[serde(default)]
pub struct DiscoveryGame {
    pub game_title: String,
    pub game_main_image: String,
    pub game_description: String,
    pub game_magnetlink: String,
    pub game_torrent_paste_link: String,
    pub game_secondary_images: Vec<String>,
    pub game_tags: String,
    pub game_href: String,
}
