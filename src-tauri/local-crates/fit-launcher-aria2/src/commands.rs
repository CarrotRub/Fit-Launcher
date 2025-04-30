use aria2_ws::response::{Status, Version};
use fit_launcher_ddl::DirectLink;

use crate::{
    aria2::aria2_add_uri,
    error::Aria2Error,
    structs::{Task, TaskProgress},
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
/// filename:
/// > aria2 will ignore the filename suggestion from URL or `Content-Disposition`,
/// >
/// > instead use this filename
///
/// ### returns
///
/// `gid` of the download task.
#[tauri::command]
pub async fn aria2_start_download(
    state: tauri::State<'_, TorrentSession>,
    url: String,
    dir: Option<String>,
    filename: String,
) -> Result<String, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    aria2_add_uri(&aria2_client, url, dir, filename).await
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.pause
#[tauri::command]
pub async fn aria2_pause(
    state: tauri::State<'_, TorrentSession>,
    gid: String,
) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.pause(&gid).await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.pauseAll
#[tauri::command]
pub async fn aria2_pause_all(state: tauri::State<'_, TorrentSession>) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.pause_all().await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.unpause
#[tauri::command]
pub async fn aria2_resume(
    state: tauri::State<'_, TorrentSession>,
    gid: String,
) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.unpause(&gid).await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.unpauseAll
#[tauri::command]
pub async fn aria2_resume_all(state: tauri::State<'_, TorrentSession>) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.unpause_all().await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.remove
#[tauri::command]
pub async fn aria2_remove(
    state: tauri::State<'_, TorrentSession>,
    gid: String,
) -> Result<(), Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    Ok(aria2_client.remove(&gid).await?)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.tellStatus
#[tauri::command]
pub async fn aria2_get_status(
    state: tauri::State<'_, TorrentSession>,
    gid: String,
) -> Result<Status, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    let status = aria2_client.tell_status(&gid).await?;
    Ok(status)
}

/// https://aria2.github.io/manual/en/html/aria2c.html#aria2.getVersion
#[tauri::command]
pub async fn aria2_get_version(
    state: tauri::State<'_, TorrentSession>,
) -> Result<Version, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    let status = aria2_client.get_version().await?;
    Ok(status)
}

/// start download and receive corresponding gid's.
///
/// dir: output directory, leave None to use default (user Downloads)
#[tauri::command]
pub async fn aria2_task_spawn(
    direct_links: Vec<DirectLink>,
    dir: Option<String>,
    state: tauri::State<'_, TorrentSession>,
) -> Result<Vec<Result<Task, Aria2Error>>, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    let mut results = Vec::with_capacity(direct_links.len());

    for DirectLink { url, filename } in direct_links {
        results.push(
            aria2_add_uri(&aria2_client, url.clone(), dir.clone(), filename.clone())
                .await
                .map(|gid| Task { gid, filename }),
        );
    }

    Ok(results)
}

/// get total completed bytes
#[tauri::command]
pub async fn aria2_task_progress(
    tasks: Vec<Task>,
    state: tauri::State<'_, TorrentSession>,
) -> Result<TaskProgress, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .map_err(|_| Aria2Error::NotConfigured)?;

    let mut completed_length = 0;
    let mut total_length = 0;
    let mut download_speed = 0;
    let mut completed = 0;

    for Task { gid, .. } in tasks {
        let status = aria2_client.tell_status(&gid).await?;

        match status.status {
            aria2_ws::response::TaskStatus::Complete => {
                completed += 1;
            }
            _ => (),
        }

        download_speed += status.download_speed;
        total_length += status.total_length;
        completed_length += status.completed_length;
    }

    Ok(TaskProgress {
        completed,
        download_speed,
        total_length,
        completed_length,
    })
}
