use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct SingularGame {
    pub title: String,
    pub img: String,
    pub desc: String,
    pub magnetlink: String,
    pub href: String,
    pub tag: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct Game {
    pub title: String,
    pub img: String,
    pub desc: String,
    pub magnetlink: String,
    pub href: String,
    pub tag: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, Type)]
pub struct GamePage {
    pub game_title: String,
    pub game_main_image: String,
    pub game_description: String,
    pub game_magnetlink: String,
    pub game_torrent_paste_link: String,
    pub game_secondary_images: Vec<String>,
    pub game_tags: String,
    pub game_href: String,
}
