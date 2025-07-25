use std::{fs, path::PathBuf};

use directories::BaseDirs;
use tracing::error;

fn ensure_path(path: &PathBuf, is_file: bool) {
    if is_file {
        if let Some(parent) = path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                error!("Failed to create parent directories: {e}");
            }
        }
        if !path.exists() {
            if let Err(e) = fs::File::create(path) {
                error!("Failed to create file {}: {e}", path.display());
            }
        }
    } else if let Err(e) = fs::create_dir_all(path) {
        error!("Failed to create directory: {e}");
    }
}

pub fn get_games_to_download_path() -> PathBuf {
    let Some(base_dirs) = BaseDirs::new() else {
        error!("Failed to determine base directories");
        return PathBuf::new();
    };

    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("collections")
        .join("games_to_download.json");

    ensure_path(&path, true);
    path
}

pub fn get_downloaded_games_path() -> PathBuf {
    let Some(base_dirs) = BaseDirs::new() else {
        error!("Failed to determine base directories");
        return PathBuf::new();
    };

    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("downloadedGames")
        .join("downloaded_games.json");

    ensure_path(&path, true);
    path
}

pub fn get_collection_list_path() -> PathBuf {
    let Some(base_dirs) = BaseDirs::new() else {
        error!("Failed to determine base directories");
        return PathBuf::new();
    };

    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("collections");

    ensure_path(&path, false);
    path
}
