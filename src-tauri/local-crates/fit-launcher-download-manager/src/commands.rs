use crate::{manager::DownloadManager, types::*};
use fit_launcher_ddl::DirectLink;
use fit_launcher_scraping::structs::Game;
#[cfg(windows)]
use fit_launcher_ui_automation::controller_manager::ControllerManager;
use fit_launcher_ui_automation::{
    InstallationError, api::InstallationManager, errors::ExtractError, extract_archive,
};
use specta::specta;
use std::{collections::HashMap, path::PathBuf, sync::Arc};
use tauri::State;
use tracing::{error, info};
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
    let job_id = dm
        .add_ddl_job(files, path, game)
        .await
        .map_err(|e| e.to_string())?;

    // Only register download for early UAC if auto-install is enabled
    #[cfg(windows)]
    {
        let settings = fit_launcher_config::commands::get_installation_settings();
        if settings.auto_install
            && let Ok(uuid) = Uuid::parse_str(&job_id)
            && let Err(e) = ControllerManager::global().register_download(uuid)
        {
            error!("Failed to register download with controller: {}", e);
        }
    }

    Ok(job_id)
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
    let job_id = dm
        .add_torrent_job(magnet, files_list, path, game)
        .await
        .map_err(|e| e.to_string())?;

    // Only register download for early UAC if auto-install is enabled
    #[cfg(windows)]
    {
        let settings = fit_launcher_config::commands::get_installation_settings();
        if settings.auto_install
            && let Ok(uuid) = Uuid::parse_str(&job_id)
            && let Err(e) = ControllerManager::global().register_download(uuid)
        {
            error!("Failed to register download with controller: {}", e);
        }
    }

    Ok(job_id)
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
pub async fn dm_run_automate_setup_install(
    state: tauri::State<'_, InstallationManager>,
    app_handle: tauri::AppHandle,
    job: Job,
) -> Result<Uuid, InstallationError> {
    info!(
        "Starting installation process for: {}",
        &job.metadata.game_title
    );
    let id = state.create_job(job.game, job.job_path).await;

    // Get the job data we need before spawning
    // This avoids Send issues by extracting Send-safe data first
    let manager = state.inner().clone();

    // Use spawn_blocking because the installer uses Windows-specific blocking I/O
    // that contains raw pointers (HANDLE) which aren't Send
    tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(async move {
            manager.start_job(id, app_handle).await;
        });
    });

    Ok(id)
}

#[tauri::command]
#[specta]
pub async fn dm_clean_job(
    state: tauri::State<'_, InstallationManager>,
    dm: State<'_, Arc<DownloadManager>>,
    job_id: String,
    installation_id: Uuid,
) -> Result<(), InstallationError> {
    dm.remove(&job_id).await.map_err(|e| e.to_string()).unwrap();
    //todo: bbetter error handling
    state.clean_job(installation_id).await;

    Ok(())
}

#[tauri::command]
#[specta]
pub async fn dm_extract_and_install(
    manager: tauri::State<'_, InstallationManager>,
    app_handle: tauri::AppHandle,
    job: Job,
    auto_clean: bool,
) -> Result<Uuid, ExtractError> {
    let list = job.job_path.read_dir()?;
    let mut groups: HashMap<String, Vec<PathBuf>> = HashMap::new();

    for entry in list.flatten() {
        if entry
            .metadata()
            .map_err(|e| InstallationError::IOError(e.to_string()))?
            .is_dir()
        {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".rar") {
            continue;
        }

        let group = name.split_once(".part").map(|(g, _)| g).unwrap_or(&name);
        groups.entry(group.into()).or_default().push(entry.path());
    }

    for paths in groups.values() {
        if let Some(first) = paths.first() {
            info!("Extracting {first:?} in-place...");
            extract_archive(first)?;
        }
    }

    if auto_clean {
        let mut set = tokio::task::JoinSet::new();
        for rar in groups.into_values().flatten() {
            set.spawn(tokio::fs::remove_file(rar));
        }
        set.join_all().await;
    }

    let id = manager.create_job(job.game, job.job_path.clone()).await;

    // Use spawn_blocking because the installer uses Windows-specific blocking I/O
    // that contains raw pointers (HANDLE) which aren't Send
    let manager_clone = manager.inner().clone();
    tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(async move {
            manager_clone.start_job(id, app_handle).await;
        });
    });

    Ok(id)
}
