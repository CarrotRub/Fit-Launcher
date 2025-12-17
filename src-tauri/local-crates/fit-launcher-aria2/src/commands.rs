use aria2_ws::response::{GlobalStat, Status, Version};
use fit_launcher_ddl::DirectLink;
use specta::specta;
use tauri::AppHandle;
use tracing::error;

use crate::{
    aria2::{aria2_add_torrent, aria2_add_uri},
    error::Aria2Error,
    structs::{AriaTask, AriaTaskProgress, AriaTaskResult},
};
use fit_launcher_torrent::functions::TorrentSession;

/// ### params
///
/// `url`:
/// > target URL to download
///
/// `dir`:
/// > optional, aria2 will download the file to this directory.
/// >
/// > when not specified, aria2 will follow its startup options
///
/// `filename`:
/// > aria2 will ignore the filename suggestion from URL or `Content-Disposition`,
/// >
/// > instead use this filename
///
/// ### returns
///
/// `gid` of the download task.
#[tauri::command]
#[specta]
pub async fn aria2_start_download(
    state: tauri::State<'_, TorrentSession>,
    url: Vec<String>,
    dir: Option<String>,
    filename: Option<String>,
) -> Result<String, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    aria2_add_uri(&aria2_client, url, dir, filename, state.config().await.rpc).await
}

/// `selected_files`: list of torrent metadata files index
///     when left empty, does nothing.
#[tauri::command]
#[specta]
pub async fn aria2_start_torrent(
    state: tauri::State<'_, TorrentSession>,
    torrent: Vec<u8>,
    dir: Option<String>,
    selected_files: Vec<usize>,
) -> Result<String, Aria2Error> {
    let aria2_client = state.aria2_client().await.map_err(|e| {
        error!("Error getting aria2 client: {e}");
        Aria2Error::NotConfigured
    })?;

    aria2_add_torrent(&aria2_client, torrent, dir, selected_files).await
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.pause
#[tauri::command]
#[specta]
pub async fn aria2_pause(
    state: tauri::State<'_, TorrentSession>,
    gid: String,
) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.pause(&gid).await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.pauseAll
#[tauri::command]
#[specta]
pub async fn aria2_pause_all(state: tauri::State<'_, TorrentSession>) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.pause_all().await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.unpause
#[tauri::command]
#[specta]
pub async fn aria2_resume(
    state: tauri::State<'_, TorrentSession>,
    gid: String,
) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.unpause(&gid).await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.unpauseAll
#[tauri::command]
#[specta]
pub async fn aria2_resume_all(state: tauri::State<'_, TorrentSession>) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.unpause_all().await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.remove
#[tauri::command]
#[specta]
pub async fn aria2_remove(
    state: tauri::State<'_, TorrentSession>,
    gid: String,
) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.remove(&gid).await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.tellStatus
#[tauri::command]
#[specta]
pub async fn aria2_get_status(
    state: tauri::State<'_, TorrentSession>,
    gid: String,
) -> Result<Status, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let status: Status = aria2_client.tell_status(&gid).await?;
    Ok(status)
}

#[tauri::command]
#[specta]
pub async fn aria2_get_list_active(
    state: tauri::State<'_, TorrentSession>,
) -> Result<Vec<Status>, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let active = aria2_client.tell_active().await?;
    Ok(active)
}

#[tauri::command]
#[specta]
pub async fn aria2_get_list_waiting(
    state: tauri::State<'_, TorrentSession>,
) -> Result<Vec<Status>, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let waiting = aria2_client.tell_waiting(0, 100).await?;
    Ok(waiting)
}

#[tauri::command]
#[specta]
pub async fn aria2_get_list_stopped(
    state: tauri::State<'_, TorrentSession>,
) -> Result<Vec<Status>, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let stopped = aria2_client.tell_stopped(0, 100).await?;
    Ok(stopped)
}

#[tauri::command]
#[specta]
pub async fn aria2_get_all_list(
    state: tauri::State<'_, TorrentSession>,
) -> Result<Vec<Status>, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let mut active = aria2_client.tell_active().await?;
    let mut waiting = aria2_client.tell_waiting(0, 100).await?;
    let mut stopped = aria2_client.tell_stopped(0, 100).await?;

    let mut list: Vec<Status> = Vec::new();

    list.append(&mut active);
    list.append(&mut waiting);
    list.append(&mut stopped);

    Ok(list)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.getVersion
#[tauri::command]
#[specta]
pub async fn aria2_get_version(
    state: tauri::State<'_, TorrentSession>,
) -> Result<Version, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let status = aria2_client.get_version().await?;
    Ok(status)
}

/// start download and receive corresponding gid's.
///
/// dir: output directory, leave None to use default (user Downloads)
#[tauri::command]
#[specta]
pub async fn aria2_task_spawn(
    direct_links: Vec<DirectLink>,
    dir: Option<String>,
    state: tauri::State<'_, TorrentSession>,
) -> Result<Vec<AriaTaskResult>, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let mut results = Vec::with_capacity(direct_links.len());

    for DirectLink {
        url,
        filename,
        size: _,
    } in direct_links
    {
        let result = aria2_add_uri(
            &aria2_client,
            vec![url.clone()],
            dir.clone(),
            Some(filename.clone()),
            state.config().await.rpc,
        )
        .await;

        match result {
            Ok(gid) => results.push(AriaTaskResult {
                task: Some(AriaTask { gid, filename }),
                error: None,
            }),
            Err(err) => results.push(AriaTaskResult {
                task: None,
                error: Some(err),
            }),
        }
    }

    Ok(results)
}

/// get total completed bytes
#[tauri::command]
#[specta]
pub async fn aria2_task_progress(
    tasks: Vec<AriaTask>,
    state: tauri::State<'_, TorrentSession>,
) -> Result<AriaTaskProgress, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let mut completed_length = 0;
    let mut total_length = 0;
    let mut download_speed = 0;
    let mut completed = 0;

    for AriaTask { gid, .. } in tasks {
        let status = aria2_client.tell_status(&gid).await?;

        if status.status == aria2_ws::response::TaskStatus::Complete {
            completed += 1;
        }

        download_speed += status.download_speed;
        total_length += status.total_length;
        completed_length += status.completed_length;
    }

    Ok(AriaTaskProgress {
        completed,
        download_speed,
        total_length,
        completed_length,
    })
}

#[tauri::command]
#[specta]
pub async fn aria2_global_stat(
    state: tauri::State<'_, TorrentSession>,
) -> Result<GlobalStat, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|_| Aria2Error::NotConfigured)?;

    let stat = aria2_client.get_global_stat().await?;
    Ok(stat)
}

#[tauri::command]
#[specta]
pub fn panic_force(_app: AppHandle) {
    panic!("INTENTIONAL PANIC");
}
