use std::path::Path;
use std::{path::PathBuf, str::FromStr};

use fitgirl_decrypt::Paste;
use fitgirl_decrypt::base64::prelude::*;
use http::StatusCode;
use librqbit::ApiError;

use tracing::{error, info};

use crate::config::FitLauncherConfig;
use crate::functions::TorrentSession;
use fit_launcher_ui_automation::mighty_automation::windows_ui_automation;

use super::*;

use librqbit::{
    AddTorrent, AddTorrentOptions, Magnet,
    api::{
        ApiAddTorrentResponse, EmptyJsonResponse, TorrentDetailsResponse, TorrentIdOrHash,
        TorrentListResponse, TorrentStats,
    },
};

#[tauri::command]
pub fn download_torrent_from_paste(paste_link: String) -> Result<Vec<u8>, fitgirl_decrypt::Error> {
    let paste = Paste::parse_url(&paste_link)?;
    let attachment = paste.decrypt()?;
    let torrent_b64 = attachment
        .attachment
        .strip_prefix("data:application/x-bittorrent;base64,")
        .ok_or(fitgirl_decrypt::Error::IllFormedURL)?;
    let torrent = BASE64_STANDARD.decode(torrent_b64)?;
    Ok(torrent)
}

#[tauri::command]
pub fn torrents_list(state: tauri::State<TorrentSession>) -> Result<TorrentListResponse, ApiError> {
    Ok(state.api()?.api_torrent_list())
}

#[tauri::command]
pub async fn torrent_create_from_url(
    state: tauri::State<'_, TorrentSession>,
    url: String,
    opts: Option<AddTorrentOptions>,
) -> Result<ApiAddTorrentResponse, ApiError> {
    state
        .api()?
        .api_add_torrent(AddTorrent::Url(url.into()), opts)
        .await
}

#[tauri::command]
pub async fn torrent_create_from_torrent(
    state: tauri::State<'_, TorrentSession>,
    torrent: Vec<u8>,
    opts: Option<AddTorrentOptions>,
) -> Result<ApiAddTorrentResponse, ApiError> {
    state
        .api()?
        .api_add_torrent(AddTorrent::TorrentFileBytes(torrent.into()), opts)
        .await
}

#[tauri::command]
pub async fn get_torrent_idx_from_url(url: String) -> Result<String, ApiError> {
    let actual_torrent_magnet = match Magnet::parse(&url) {
        Ok(magnet) => magnet,
        Err(e) => {
            error!("Error Parsing Magnet : {:#?}", e);
            return Err(ApiError::new_from_anyhow(
                StatusCode::from_u16(401).unwrap(),
                e,
            ));
        }
    };

    let actual_torrent_id20 = Magnet::as_id20(&actual_torrent_magnet);
    Ok(TorrentIdOrHash::Hash(actual_torrent_id20.unwrap()).to_string())
}

#[tauri::command]
pub async fn torrent_details(
    state: tauri::State<'_, TorrentSession>,
    id: TorrentIdOrHash,
) -> Result<TorrentDetailsResponse, ApiError> {
    state.api()?.api_torrent_details(id)
}

#[tauri::command]
pub async fn torrent_stats(
    state: tauri::State<'_, TorrentSession>,
    id: TorrentIdOrHash,
) -> Result<TorrentStats, ApiError> {
    state.api()?.api_stats_v1(id)
}

#[tauri::command]
pub async fn torrent_action_delete(
    state: tauri::State<'_, TorrentSession>,
    id: TorrentIdOrHash,
) -> Result<EmptyJsonResponse, ApiError> {
    state.api()?.api_torrent_action_delete(id).await
}

#[tauri::command]
pub async fn torrent_action_pause(
    state: tauri::State<'_, TorrentSession>,
    id: TorrentIdOrHash,
) -> Result<EmptyJsonResponse, ApiError> {
    state.api()?.api_torrent_action_pause(id).await
}

#[tauri::command]
pub async fn torrent_action_forget(
    state: tauri::State<'_, TorrentSession>,
    id: TorrentIdOrHash,
) -> Result<EmptyJsonResponse, ApiError> {
    state.api()?.api_torrent_action_forget(id).await
}

#[tauri::command]
pub async fn torrent_action_start(
    state: tauri::State<'_, TorrentSession>,
    id: TorrentIdOrHash,
) -> Result<EmptyJsonResponse, ApiError> {
    state.api()?.api_torrent_action_start(id).await
}

#[tauri::command]
pub async fn get_torrent_full_settings(
    state: tauri::State<'_, TorrentSession>,
) -> Result<FitLauncherConfig, ApiError> {
    Ok(state.get_config().await)
}

#[tauri::command]
pub async fn change_torrent_config(
    state: tauri::State<'_, TorrentSession>,
    config: FitLauncherConfig,
) -> Result<EmptyJsonResponse, ApiError> {
    state.configure(config).await.map(|_| EmptyJsonResponse {})
}

#[tauri::command]
pub async fn config_change_only_path(
    state: tauri::State<'_, TorrentSession>,
    download_path: String,
) -> Result<EmptyJsonResponse, ApiError> {
    // Get the current config
    let mut current_config = state.get_config().await;
    // Convert the string path to a PathBuf and update the default_download_location
    current_config.default_download_location = PathBuf::from(download_path);

    // Save the updated config
    state
        .configure(current_config)
        .await
        .map(|_| EmptyJsonResponse {})
}

#[tauri::command]
/// This function needs to receive the least arguments possible to detangle the code.
/// The more this function receives arguments the more the code will be spaghetti code and no one will look at it so it's better to make it hard and complicated
/// in Rust as at least it is better and readable compared to JS.
///
/// # Important
pub async fn run_automate_setup_install(
    _state: tauri::State<'_, TorrentSession>,
    id: TorrentIdOrHash,
) -> Result<(), ApiError> {
    let session_json_path = directories::BaseDirs::new()
        .expect("Could not determine base directories")
        .config_local_dir()
        .join("com.fitlauncher.carrotrub")
        .join("torrentConfig")
        .join("session")
        .join("data")
        .join("session.json");

    let file_content = std::fs::read_to_string(&session_json_path).unwrap_or_else(|err| {
        error!(
            "Error reading the file at {:?}: {:#?}",
            session_json_path, err
        );
        "{}".to_string() // Return an empty JSON object as a fallback
    });

    let session_config_json: serde_json::Value = serde_json::from_str(&file_content)
        .unwrap_or_else(|err| {
            error!("Error parsing JSON: {:#?}", err);
            serde_json::Value::default()
        });

    let mut torrent_folder: Option<String> = None;

    if let Some(torrents) = session_config_json.get("torrents") {
        // Convert the `id` into a string to match the hash
        let id_hash = id.to_string(); // Assume `id.to_string()` gives the correct hash representation

        // Iterate over torrents to find a matching "info_hash"
        if let Some((_, torrent)) = torrents.as_object().and_then(|obj| {
            obj.iter().find(|(_, torrent)| {
                torrent
                    .get("info_hash")
                    .is_some_and(|hash| hash == &id_hash)
            })
        }) {
            if let Some(output_folder) = torrent.get("output_folder") {
                torrent_folder = Some(output_folder.to_string().replace("\"", ""));
            } else {
                error!(
                    "Torrent with ID '{}' found, but no output_folder key present.",
                    id_hash
                );
            }
        } else {
            error!("No torrent found with the given ID/hash: {}", id_hash);
        }
    } else {
        error!("No 'torrents' object found in the JSON.");
    }

    if let Some(folder) = torrent_folder {
        let setup_path = PathBuf::from_str(&folder).unwrap().join("setup.exe");
        info!("Setup path is : {}", setup_path.to_str().unwrap());
        windows_ui_automation::start_executable_components_args(setup_path);

        let game_output_folder = folder.replace(" [FitGirl Repack]", "");

        windows_ui_automation::automate_until_download(&game_output_folder).await;
        info!("Torrent has completed!");
        info!("Game Installation Has been Started");

        Ok(())
    } else {
        error!("Failed to initialize torrent_folder. Aborting operation.");

        Err(ApiError::new_from_text(
            StatusCode::from_u16(401).unwrap(),
            "Failed to initialize torrent_folder. Aborting operation",
        ))
    }
}

#[tauri::command]
pub async fn delete_game_folder_recursively(folder_path: &Path) -> Result<(), ApiError> {
    if folder_path.exists() && folder_path.is_dir() {
        return match tokio::fs::remove_dir_all(folder_path).await {
            Ok(_) => {
                info!("Correctly removed directory: {:#?}", &folder_path);
                Ok(())
            }
            Err(e) => {
                error!("Error removing directory: {}", e);
                Err(ApiError::new_from_anyhow(
                    StatusCode::from_u16(401).unwrap(),
                    anyhow::Error::new(e),
                ))
            }
        };
    }
    Ok(())
}

//TODO: Add clear cache functions
