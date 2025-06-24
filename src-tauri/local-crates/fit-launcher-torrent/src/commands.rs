use std::path::Path;
use std::{path::PathBuf, str::FromStr};

use fitgirl_decrypt::Paste;
use fitgirl_decrypt::base64::prelude::*;

use librqbit_core::torrent_metainfo::torrent_from_bytes;
use specta::specta;
use tracing::{error, info};

use crate::errors::TorrentApiError;
use crate::functions::TorrentSession;
use crate::model::FileInfo;
use fit_launcher_ui_automation::mighty_automation::windows_ui_automation;

use super::*;

#[tauri::command]
#[specta]
pub async fn download_torrent_from_paste(
    paste_link: String,
) -> Result<Vec<u8>, fitgirl_decrypt::Error> {
    let paste = Paste::parse_url(&paste_link)?;
    let cipherinfo = paste.request_async().await?;

    let attachment = tokio::task::spawn_blocking(move || {
        let paste = Paste::parse_url(&paste_link).unwrap();
        paste.decrypt(&cipherinfo)
    })
    .await
    .expect("join error")
    .map_err(|_| fitgirl_decrypt::Error::DecompressError)?;

    let torrent_b64 = attachment
        .attachment
        .strip_prefix("data:application/x-bittorrent;base64,")
        .ok_or(fitgirl_decrypt::Error::IllFormedURL)?
        .to_string();
    let torrent = tokio::task::spawn_blocking(move || BASE64_STANDARD.decode(torrent_b64))
        .await
        .expect("Join error")?;
    Ok(torrent)
}

#[tauri::command]
#[specta]
pub async fn list_torrent_files(torrent: Vec<u8>) -> Result<Vec<FileInfo>, String> {
    let torrent =
        torrent_from_bytes::<librqbit_buffers::ByteBuf>(&torrent).map_err(|e| e.to_string())?;

    Ok(torrent
        .info
        .iter_file_details()
        .map_err(|e| e.to_string())?
        .enumerate()
        .flat_map(|(idx, detail)| -> anyhow::Result<FileInfo> {
            Ok(FileInfo {
                file_name: detail.filename.to_pathbuf()?,
                length: detail.len,
                file_index: idx + 1,
            })
        })
        .collect())
}

#[tauri::command]
#[specta]
pub async fn get_download_settings(
    state: tauri::State<'_, TorrentSession>,
) -> Result<FitLauncherConfigV2, TorrentApiError> {
    Ok(state.get_config().await)
}

#[tauri::command]
#[specta]
pub async fn change_download_settings(
    state: tauri::State<'_, TorrentSession>,
    config: FitLauncherConfigV2,
) -> Result<(), TorrentApiError> {
    state.configure(config).await?;
    Ok(())
}

#[tauri::command]
#[specta]
pub async fn config_change_only_path(
    state: tauri::State<'_, TorrentSession>,
    download_path: String,
) -> Result<(), TorrentApiError> {
    let mut current_config = state.get_config().await;
    current_config.general.download_dir = PathBuf::from(download_path);

    state.configure(current_config).await
}

#[tauri::command]
#[specta]
/// This function needs to receive the least arguments possible to detangle the code.
/// The more this function receives arguments the more the code will be spaghetti code and no one will look at it so it's better to make it hard and complicated
/// in Rust as at least it is better and readable compared to JS.
///
/// # Important
pub async fn run_automate_setup_install(
    _state: tauri::State<'_, TorrentSession>,
    id: String,
) -> Result<(), TorrentApiError> {
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
        let id_hash = id;

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
        Err(TorrentApiError::InitError(
            "Failed to initialize torrent_folder. Aborting operation".to_string(),
        ))
    }
}

#[tauri::command]
#[specta]
pub async fn delete_game_folder_recursively(folder_path: &str) -> Result<(), TorrentApiError> {
    let folder = Path::new(folder_path);
    if folder.exists() && folder.is_dir() {
        return match tokio::fs::remove_dir_all(folder).await {
            Ok(_) => {
                info!("Correctly removed directory: {:#?}", &folder);
                Ok(())
            }
            Err(e) => {
                error!("Error removing directory: {}", e);
                Err(TorrentApiError::IOError(e.to_string()))
            }
        };
    }
    Ok(())
}
