use std::path::PathBuf;

use directories::BaseDirs;
use tracing::error;

pub fn get_games_to_download_path() -> PathBuf {
    let base_dirs = match BaseDirs::new() {
        Some(dirs) => dirs,
        None => {
            error!("Failed to determine base directories");
            return PathBuf::new();
        }
    };

    base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("collections")
        .join("games_to_download.json")
}

pub fn get_downloaded_games_path() -> PathBuf {
    let base_dirs = match BaseDirs::new() {
        Some(dirs) => dirs,
        None => {
            error!("Failed to determine base directories");
            return PathBuf::new();
        }
    };

    base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("downloadedGames")
        .join("downloaded_games.json")
}

pub fn get_collection_list_path() -> PathBuf {
    let base_dirs = match BaseDirs::new() {
        Some(dirs) => dirs,
        None => {
            error!("Failed to determine base directories");
            return PathBuf::new();
        }
    };

    base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("collections")
}
