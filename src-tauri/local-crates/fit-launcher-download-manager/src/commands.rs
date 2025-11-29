use crate::{manager::DownloadManager, types::*};
use fit_launcher_ddl::DirectLink;
use fit_launcher_scraping::structs::Game;
use fit_launcher_ui_automation::{InstallationError, api::InstallationManager};
use specta::specta;
use std::sync::Arc;
use tauri::State;
use tracing::error;
use uuid::Uuid;

#[tauri::command]
#[specta]
pub async fn dm_all_jobs(dm: State<'_, Arc<DownloadManager>>) -> Result<Vec<Job>, String> {
    Ok(dm.all_jobs().await)
}

#[tauri::command]
#[specta]
pub async fn dm_add_ddl_job(
    dm: State<'_, Arc<DownloadManager>>,
    files: Vec<DirectLink>,
    target: String,
    game: Game,
) -> Result<JobId, String> {
    let path = std::path::PathBuf::from(target);
    dm.add_ddl_job(files, path, game)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta]
pub async fn dm_add_torrent_job(
    dm: State<'_, Arc<DownloadManager>>,
    magnet: String,
    files_list: Vec<usize>,
    target: String,
    game: Game,
) -> Result<JobId, String> {
    let path = std::path::PathBuf::from(target);
    dm.add_torrent_job(magnet, files_list, path, game)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta]
pub async fn dm_pause(dm: State<'_, Arc<DownloadManager>>, job_id: String) -> Result<(), String> {
    dm.pause(&job_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta]
pub async fn dm_resume(dm: State<'_, Arc<DownloadManager>>, job_id: String) -> Result<(), String> {
    dm.resume(&job_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta]
pub async fn dm_remove(dm: State<'_, Arc<DownloadManager>>, job_id: String) -> Result<(), String> {
    dm.remove(&job_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta]
pub async fn dm_save_now(dm: State<'_, Arc<DownloadManager>>) -> Result<(), String> {
    dm.save_now().await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta]
pub async fn dm_load_from_disk(dm: State<'_, Arc<DownloadManager>>) -> Result<(), String> {
    dm.load_from_disk().await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta]
pub async fn run_automate_setup_install(
    state: tauri::State<'_, InstallationManager>,
    app_handle: tauri::AppHandle,
    job: Job,
) -> Result<Uuid, InstallationError> {
    let id = state.create_job(job.game, job.job_path).await;

    state.start_job(id, app_handle.clone()).await;

    Ok(id)
}
