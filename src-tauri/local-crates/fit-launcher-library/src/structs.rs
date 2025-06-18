use std::path::PathBuf;

use fit_launcher_scraping::structs::Game;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Debug, Type)]
pub struct DownloadedGame {
    pub title: String,
    pub img: String,
    pub desc: String,
    pub magnetlink: String,
    pub href: String,
    pub tag: String,
    pub executable_info: ExecutableInfo,
    pub installation_info: InstallationInfo,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct ExecutableInfo {
    pub executable_path: PathBuf,
    pub executable_last_opened_date: Option<String>,
    pub executable_play_time: u64,
    pub executable_installed_date: Option<String>,
    pub executable_disk_size: u64,
}

#[derive(Serialize, Deserialize, Debug, Type)]
pub struct InstallationInfo {
    pub output_folder: String,
    pub download_folder: String,
    pub file_list: Vec<String>,
    pub executable_info: ExecutableInfo,
}

#[derive(Serialize, Deserialize, Debug, Type)]
pub struct GameCollection {
    pub name: String,
    pub games_list: Vec<Game>,
}
