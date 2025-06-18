use std::{
    fs::{self, remove_dir},
    path::PathBuf,
};

use directories::BaseDirs;
use fit_launcher_scraping::structs::Game;
use specta::specta;
use tracing::error;

use crate::{
    legacy::{LegacyDownloadedGame, convert_legacy_downloads},
    structs::{DownloadedGame, ExecutableInfo, GameCollection, InstallationInfo},
};

#[tauri::command]
#[specta]
pub async fn get_games_to_download() -> Vec<Game> {
    let base_dirs = BaseDirs::new()
        .ok_or_else(|| error!("Failed to determine base directories"))
        .unwrap();

    let installation_file_path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("games_to_download.json");

    let file_content = fs::read_to_string(&installation_file_path)
        .map_err(|err| {
            error!(
                "Error reading the file at {:?}: {:#?}",
                installation_file_path, err
            );
        })
        .unwrap_or("{}".to_string());

    serde_json::from_str::<Vec<Game>>(&file_content).unwrap_or_default()
}

#[tauri::command]
#[specta]
pub async fn get_downloaded_games() -> Vec<DownloadedGame> {
    let base_dirs = match BaseDirs::new() {
        Some(dirs) => dirs,
        None => {
            error!("Failed to determine base directories");
            return vec![];
        }
    };

    let installation_file_path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("downloadedGames")
        .join("downloaded_games.json");

    let file_content = match fs::read_to_string(&installation_file_path) {
        Ok(content) => content,
        Err(err) => {
            error!(
                "Error reading the file at {:?}: {:#?}",
                installation_file_path, err
            );
            return vec![];
        }
    };

    // Try modern format first
    if let Ok(games) = serde_json::from_str::<Vec<DownloadedGame>>(&file_content) {
        return games;
    }

    // Fallback to legacy
    if let Ok(legacy_games) = serde_json::from_str::<Vec<LegacyDownloadedGame>>(&file_content) {
        return convert_legacy_downloads(legacy_games);
    }

    error!("Failed to parse downloaded games in any known format");
    vec![]
}

#[tauri::command]
#[specta]
pub async fn get_collection_list() -> Vec<GameCollection> {
    let base_dirs = match BaseDirs::new() {
        Some(dirs) => dirs,
        None => {
            error!("Failed to determine base directories");
            return vec![];
        }
    };

    let collection_folder = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("collection");

    let mut collections = Vec::new();

    let entries = match fs::read_dir(&collection_folder) {
        Ok(entries) => entries,
        Err(err) => {
            error!("Error reading collection folder: {:?}", err);
            return vec![];
        }
    };

    for entry in entries.flatten() {
        let path: PathBuf = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            let file_name = path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("Unnamed")
                .to_string();

            match fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<Vec<Game>>(&content) {
                    Ok(games_list) => collections.push(GameCollection {
                        name: file_name,
                        games_list,
                    }),
                    Err(err) => error!("Failed to parse {}: {:?}", file_name, err),
                },
                Err(err) => {
                    error!("Failed to read file {}: {:?}", file_name, err);
                }
            }
        }
    }

    collections
}

#[tauri::command]
#[specta]
pub async fn remove_downloaded_game(game_title: String) -> Result<(), String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;
    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("downloadedGames")
        .join("downloaded_games.json");

    let file_content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut games: Vec<DownloadedGame> = serde_json::from_str(&file_content).unwrap_or_default();
    let original_len = games.len();
    games.retain(|game| game.title != game_title);

    if games.len() == original_len {
        return Err("Game not found in downloaded list".into());
    }

    fs::write(&path, serde_json::to_string_pretty(&games).unwrap()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta]
pub async fn remove_game_to_download(game_title: String) -> Result<(), String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;
    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("games_to_download.json");

    let file_content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut games: Vec<Game> = serde_json::from_str(&file_content).unwrap_or_default();
    let original_len = games.len();
    games.retain(|game| game.title != game_title);

    if games.len() == original_len {
        return Err("Game not found in games_to_download".into());
    }

    fs::write(&path, serde_json::to_string_pretty(&games).unwrap()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta]
pub async fn remove_game_from_collection(
    game_title: String,
    collection_name: String,
) -> Result<(), String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;
    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("collection")
        .join(format!("{collection_name}.json"));

    let file_content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut games: Vec<Game> = serde_json::from_str(&file_content).unwrap_or_default();
    let original_len = games.len();
    games.retain(|game| game.title != game_title);

    if games.len() == original_len {
        return Err("Game not found in collection".into());
    }

    fs::write(&path, serde_json::to_string_pretty(&games).unwrap()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta]
pub async fn remove_collection(collection_name: String) -> Result<(), String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;
    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("collection")
        .join(format!("{collection_name}.json"));

    if !path.exists() {
        return Err(format!("Collection '{}' does not exist", collection_name));
    }

    fs::remove_file(&path)
        .map_err(|err| format!("Failed to remove collection '{}': {}", collection_name, err))?;

    Ok(())
}

#[tauri::command]
#[specta]
pub async fn update_downloaded_game_executable_info(
    game_title: String,
    executable_info: ExecutableInfo,
) -> Result<(), String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;

    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("downloadedGames")
        .join("downloaded_games.json");

    let file_content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut games: Vec<DownloadedGame> = serde_json::from_str(&file_content).unwrap_or_default();

    let Some(target_game) = games.iter_mut().find(|game| game.title == game_title) else {
        return Err(format!("Game '{}' not found", game_title));
    };

    target_game.executable_info = executable_info.clone();
    target_game.installation_info.executable_info = executable_info;

    fs::write(&path, serde_json::to_string_pretty(&games).unwrap()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta]
pub fn transform_legacy_download(legacy_items: Vec<LegacyDownloadedGame>) -> Vec<DownloadedGame> {
    legacy_items
        .into_iter()
        .map(|legacy| DownloadedGame {
            title: legacy.torrentExternInfo.title,
            img: legacy.torrentExternInfo.img,
            desc: legacy.torrentExternInfo.desc,
            magnetlink: legacy.torrentExternInfo.magnetlink,
            href: legacy.torrentExternInfo.href,
            tag: legacy.torrentExternInfo.tag,
            executable_info: legacy.executableInfo.clone(),
            installation_info: InstallationInfo {
                output_folder: legacy.torrentOutputFolder,
                download_folder: legacy.torrentDownloadFolder,
                file_list: legacy.torrentFileList,
                executable_info: legacy.executableInfo,
            },
        })
        .collect()
}
