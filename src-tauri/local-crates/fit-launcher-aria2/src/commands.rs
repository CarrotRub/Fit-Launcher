use aria2_ws::{
    TaskOptions,
    response::{Status, Version},
};

use crate::error::Aria2Error;
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
    Ok(aria2_client
        .add_uri(
            vec![url],
            Some(TaskOptions {
                split: Some(1),
                out: Some(filename),
                dir,
                ..TaskOptions::default()
            }),
            None,
            None,
        )
        .await?)
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
