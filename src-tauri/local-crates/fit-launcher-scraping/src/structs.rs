use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SingularGame {
    pub title: String,
    pub img: String,
    pub desc: String,
    pub magnetlink: String,
    pub href: String,
    pub tag: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Game {
    pub title: String,
    pub img: String,
    pub desc: String,
    pub magnetlink: String,
    pub href: String,
    pub tag: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GamePage {
    pub game_title: String,
    pub game_main_image: String,
    pub game_description: String,
    pub game_magnetlink: String,
    pub game_secondary_images: Vec<String>,
    pub game_tags: String,
    pub game_href: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GameImages {
    my_all_images: Vec<String>,
}
