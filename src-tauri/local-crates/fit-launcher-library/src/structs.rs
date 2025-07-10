use fit_launcher_scraping::structs::Game;
use serde::de::{Deserializer, Error as SerdeError};
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Default, Serialize, Deserialize, Debug, Type)]
#[serde(default)]
pub struct DownloadedGame {
    pub title: String,
    pub img: String,
    pub desc: String,
    pub magnetlink: String,
    /// can be empty if converted from legacy,
    ///
    /// or the torrent was hosted on sendfile.su
    pub pastebin: String,
    pub href: String,
    pub tag: String,
    pub pastebin: String,
    pub executable_info: ExecutableInfo,
    pub installation_info: InstallationInfo,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, Type)]
pub struct ExecutableInfo {
    pub executable_path: String,
    pub executable_last_opened_date: Option<String>,
    #[serde(deserialize_with = "deserialize_play_time")]
    pub executable_play_time: u64,
    pub executable_installed_date: Option<String>,
    pub executable_disk_size: u64,
}

fn deserialize_play_time<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    let val = serde_json::Value::deserialize(deserializer)?;
    match val {
        serde_json::Value::Number(n) => n
            .as_u64()
            .ok_or_else(|| D::Error::custom("Invalid number for play_time")),
        serde_json::Value::String(_) => Ok(0),
        _ => Err(D::Error::custom("Invalid type for play_time")),
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Type)]
pub struct InstallationInfo {
    pub output_folder: String,
    pub download_folder: String,
    pub file_list: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Type)]
pub struct GameCollection {
    pub name: String,
    pub games_list: Vec<Game>,
}
