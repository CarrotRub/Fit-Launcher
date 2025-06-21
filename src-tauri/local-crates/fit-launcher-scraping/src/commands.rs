use std::{fs::File, io::Read, path::PathBuf};

use specta::specta;
use tauri::{AppHandle, Manager};
use tokio::{fs as tokio_fs, io::AsyncWriteExt};
use tracing::error;

use crate::{
    errors::ScrapingError,
    structs::{DiscoveryGame, Game},
};

fn get_app_subdir(app: &AppHandle, subpath: &[&str]) -> PathBuf {
    let mut base = app.path().app_data_dir().unwrap();

    for part in subpath {
        base.push(part);
    }

    base
}

fn discovery_dir(app: &AppHandle) -> PathBuf {
    get_app_subdir(app, &["tempGames", "discovery"])
}

pub fn games_dir(app: &AppHandle) -> PathBuf {
    get_app_subdir(app, &["tempGames"])
}

fn discovery_file_path(app: &AppHandle, file: &str) -> PathBuf {
    discovery_dir(app).join(file)
}

pub fn game_file_path(app: &AppHandle, filename: &str) -> PathBuf {
    games_dir(app).join(filename)
}

#[tauri::command]
#[specta]
pub fn get_discovery_json_path(app: AppHandle) -> PathBuf {
    discovery_file_path(&app, "games_list.json")
}

#[tauri::command]
#[specta]
pub fn get_discovery_meta_path(app: AppHandle) -> PathBuf {
    discovery_file_path(&app, "games_meta.json")
}

#[tauri::command]
#[specta]
pub fn get_discovery_games(app: AppHandle) -> Result<Vec<DiscoveryGame>, ScrapingError> {
    let path = discovery_file_path(&app, "games_list.json");

    let mut file = File::open(&path).map_err(|e| {
        error!("Failed to open discovery file: {}", e);
        ScrapingError::IOError(e.to_string())
    })?;

    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| {
        error!("Failed to read discovery file: {}", e);
        ScrapingError::IOError(e.to_string())
    })?;

    serde_json::from_str::<Vec<DiscoveryGame>>(&contents).map_err(|e| {
        error!("Failed to parse discovery JSON: {}", e);
        ScrapingError::FileJSONError(e.to_string())
    })
}

async fn get_games_from_file(app: &AppHandle, filename: &str) -> Result<Vec<Game>, ScrapingError> {
    let file_path = game_file_path(app, filename);

    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            tokio_fs::create_dir_all(parent)
                .await
                .map_err(|e| ScrapingError::IOError(e.to_string()))?;
        }
    }

    if !file_path.exists() {
        let mut file = tokio_fs::File::create(&file_path)
            .await
            .map_err(|e| ScrapingError::IOError(e.to_string()))?;
        file.write_all(b"[]")
            .await
            .map_err(|e| ScrapingError::IOError(e.to_string()))?;
    }

    let json = tokio_fs::read_to_string(&file_path)
        .await
        .map_err(|e| ScrapingError::IOError(e.to_string()))?;

    serde_json::from_str(&json).map_err(|e| ScrapingError::FileJSONError(e.to_string()))
}

async fn get_game_from_file(app: &AppHandle, filename: &str) -> Result<Game, ScrapingError> {
    let file_path = game_file_path(app, filename);

    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            tokio_fs::create_dir_all(parent)
                .await
                .map_err(|e| ScrapingError::IOError(e.to_string()))?;
        }
    }

    if !file_path.exists() {
        let mut file = tokio_fs::File::create(&file_path)
            .await
            .map_err(|e| ScrapingError::IOError(e.to_string()))?;
        file.write_all(b"{}")
            .await
            .map_err(|e| ScrapingError::IOError(e.to_string()))?;
    }

    let json = tokio_fs::read_to_string(&file_path)
        .await
        .map_err(|e| ScrapingError::IOError(e.to_string()))?;

    serde_json::from_str::<Game>(&json).map_err(|e| ScrapingError::FileJSONError(e.to_string()))
}

#[tauri::command]
#[specta]
pub async fn get_newly_added_games(app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    get_games_from_file(&app, "newly_added_games.json").await
}

#[tauri::command]
#[specta]
pub async fn get_popular_games(app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    get_games_from_file(&app, "popular_games.json").await
}

#[tauri::command]
#[specta]
pub async fn get_recently_updated_games(app: AppHandle) -> Result<Vec<Game>, ScrapingError> {
    get_games_from_file(&app, "recently_updated_games.json").await
}

#[tauri::command]
#[specta]
pub async fn get_singular_game_local(app: AppHandle) -> Result<Game, ScrapingError> {
    get_game_from_file(&app, "singular_game_temp.json").await
}

// JSON path getters for each file

#[tauri::command]
#[specta]
pub fn get_newly_added_games_path(app: AppHandle) -> PathBuf {
    game_file_path(&app, "newly_added_games.json")
}

#[tauri::command]
#[specta]
pub fn get_popular_games_path(app: AppHandle) -> PathBuf {
    game_file_path(&app, "popular_games.json")
}

#[tauri::command]
#[specta]
pub fn get_recently_updated_games_path(app: AppHandle) -> PathBuf {
    game_file_path(&app, "recently_updated_games.json")
}
