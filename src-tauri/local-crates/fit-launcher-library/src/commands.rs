use std::{
    fs::{self},
    path::PathBuf,
};

use directories::BaseDirs;
use fit_launcher_scraping::structs::Game;
use specta::specta;
use tracing::error;

use crate::{
    core_commands::{
        get_collection_list_path, get_downloaded_games_path, get_games_to_download_path,
    },
    legacy::{LegacyDownloadedGame, convert_legacy_downloads},
    structs::{DownloadedGame, ExecutableInfo, GameCollection},
};

#[tauri::command]
#[specta]
pub async fn get_games_to_download() -> Vec<Game> {
    let path = get_games_to_download_path();

    let file_content = fs::read_to_string(&path)
        .map_err(|err| {
            error!("Error reading the file at {:?}: {:#?}", path, err);
        })
        .unwrap_or("{}".to_string());

    serde_json::from_str::<Vec<Game>>(&file_content).unwrap_or_default()
}

#[tauri::command]
#[specta]
pub async fn get_downloaded_games() -> Vec<DownloadedGame> {
    let path = get_downloaded_games_path();

    let file_content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(err) => {
            error!("Error reading the file at {:?}: {:#?}", path, err);
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
    let path = get_collection_list_path();

    let mut collections = Vec::new();

    let entries = match fs::read_dir(&path) {
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
pub async fn add_downloaded_game(game: DownloadedGame) -> Result<(), String> {
    let path = get_downloaded_games_path();

    let mut games = get_downloaded_games().await;

    let already_exists = games.iter().any(|g| g.title == game.title);
    if already_exists {
        return Err("Game already exists in downloaded list".into());
    }

    games.push(game);

    std::fs::write(&path, serde_json::to_string_pretty(&games).unwrap())
        .map_err(|e| e.to_string())?;

    Ok(())
}
#[tauri::command]
#[specta]
pub async fn remove_downloaded_game(game_title: String) -> Result<(), String> {
    let path = get_downloaded_games_path();

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
    let path = get_games_to_download_path();

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
    let path = get_collection_list_path().join(format!("{collection_name}.json"));

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
    let path = get_collection_list_path().join(format!("{collection_name}.json"));

    if !path.exists() {
        return Err(format!("Collection '{collection_name}' does not exist"));
    }

    fs::remove_file(&path)
        .map_err(|err| format!("Failed to remove collection '{collection_name}': {err}"))?;

    Ok(())
}

#[tauri::command]
#[specta]
pub async fn update_downloaded_game_executable_info(
    game_title: String,
    executable_info: ExecutableInfo,
) -> Result<(), String> {
    let mut games = get_downloaded_games().await;
    let path = get_downloaded_games_path();

    println!("Looking for: {game_title}");
    for game in &games {
        println!("Found: {}", game.title);
    }

    let Some(target_game) = games
        .iter_mut()
        .find(|game| game.title.to_lowercase() == game_title.to_lowercase())
    else {
        return Err(format!("Game '{game_title}' not found"));
    };

    target_game.executable_info = executable_info;

    fs::write(&path, serde_json::to_string_pretty(&games).unwrap()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta]
pub fn transform_legacy_download(legacy_items: Vec<LegacyDownloadedGame>) -> Vec<DownloadedGame> {
    convert_legacy_downloads(legacy_items)
}

#[tauri::command]
#[specta]
pub async fn add_game_to_collection(collection_name: String, game: Game) -> Result<(), String> {
    let path = get_collection_list_path().join(format!("{collection_name}.json"));
    println!("Path is : {} !", path.to_str().unwrap());
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {e}"))?;
    }

    let mut games: Vec<Game> = if path.exists() {
        let file_content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&file_content).unwrap_or_default()
    } else {
        vec![]
    };

    let is_duplicate = games.iter().any(|g| g.title == game.title);

    if is_duplicate {
        return Err(format!(
            "Game '{}' already exists in collection '{}'",
            game.title, collection_name
        ));
    }

    games.push(game);
    println!("Okiee done !");

    fs::write(&path, serde_json::to_string_pretty(&games).unwrap())
        .map_err(|e| format!("Failed to write collection file: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta]
pub async fn create_collection(
    collection_name: String,
    games: Option<Vec<Game>>,
) -> Result<(), String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;

    let path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("library")
        .join("collections")
        .join(format!("{collection_name}.json"));

    if path.exists() {
        return Err(format!("Collection '{collection_name}' already exists"));
    }

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {e}"))?;
    }

    let game_list = games.unwrap_or_default();

    fs::write(&path, serde_json::to_string_pretty(&game_list).unwrap())
        .map_err(|e| format!("Failed to write collection file: {e}"))?;

    Ok(())
}
