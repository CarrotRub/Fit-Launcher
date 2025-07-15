use std::path::Path;
use std::path::PathBuf;

use fit_launcher_ui_automation::InstallationError;
use fitgirl_decrypt::Paste;
use fitgirl_decrypt::base64::prelude::*;

use librqbit_core::torrent_metainfo::torrent_from_bytes;
use specta::specta;
use tracing::{error, info};

use crate::errors::TorrentApiError;
use crate::functions::TorrentSession;
use crate::handler::get_torrent_idx_from_url;
use crate::model::FileInfo;
use fit_launcher_ui_automation::mighty_automation::windows_ui_automation::{
    automate_until_download, start_executable_components_args,
};

use super::*;

#[tauri::command]
#[specta]
pub async fn decrypt_torrent_from_paste(
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

pub async fn list_torrent_files_local(torrent: Vec<u8>) -> Result<Vec<FileInfo>, String> {
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
pub async fn get_torrent_hash(torrent: Vec<u8>) -> Result<String, String> {
    let torrent =
        torrent_from_bytes::<librqbit_buffers::ByteBuf>(&torrent).map_err(|e| e.to_string())?;
    Ok(torrent.info_hash.as_string())
}


#[tauri::command]
#[specta]
pub async fn list_torrent_files(
    librqbit_state: tauri::State<'_, LibrqbitSession>,
    magnet: String,
) -> Result<Vec<FileInfo>, TorrentApiError> {
    let info = &librqbit_state.get_metadata_only(magnet).await?.info;

    let mut files = Vec::new();

    if let Some(multi) = &info.files {
        //  convert each file's relative path (Vec<BufType>) to PathBuf
        for (i, file) in multi.iter().enumerate() {
            // Join the relative path parts as strings into PathBuf
            let file_path = file
                .path
                .iter()
                .map(|part| std::str::from_utf8(part).unwrap_or("<invalid utf8>"))
                .collect::<std::path::PathBuf>();

            files.push(FileInfo {
                file_name: file_path,
                length: file.length,
                file_index: i,
            });
        }
    } else if let Some(length) = info.length {
        let file_name = info
            .name
            .as_ref()
            .map(|name_bytes| std::str::from_utf8(name_bytes).unwrap_or("unnamed"))
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("unnamed"));

        files.push(FileInfo {
            file_name,
            length,
            file_index: 0,
        });
    }

    Ok(files)
}

#[tauri::command]
#[specta]
pub async fn magnet_to_file(
    librqbit_state: tauri::State<'_, LibrqbitSession>,
    magnet: String,
) -> Result<Vec<u8>, TorrentApiError> {
    let info = &librqbit_state.get_metadata_only(magnet).await?;

    Ok(info.torrent_bytes.clone().to_vec())
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
pub async fn run_automate_setup_install(
    _state: tauri::State<'_, TorrentSession>,
    path: PathBuf,
) -> Result<(), TorrentApiError> {
    let setup_executable_path = path.join("setup.exe");
    info!("Setup path is: {}", setup_executable_path.to_string_lossy());

    start_executable_components_args(setup_executable_path).map_err(|e| match e {
        InstallationError::AdminModeError => TorrentApiError::AdminModeError,
        InstallationError::IOError(msg) => {
            TorrentApiError::IOError(format!("Installation IO error: {msg}"))
        }
    })?;

    let game_output_folder = path.to_string_lossy().replace(" [FitGirl Repack]", "");

    automate_until_download(&game_output_folder).await;

    info!("Torrent has completed!");
    info!("Game Installation has been started");

    Ok(())
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
