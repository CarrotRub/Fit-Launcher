use aria2_ws::response::GlobalStat;
use specta::specta;
use std::sync::Arc;

use crate::error::Aria2Error;
use fit_launcher_torrent::functions::TorrentSession;

#[tauri::command]
#[specta]
pub async fn aria2_global_stat(
    state: tauri::State<'_, Arc<TorrentSession>>,
) -> Result<GlobalStat, Aria2Error> {
    let aria2_client = state
        .aria2_client()
        .await
        .map_err(|e| Aria2Error::InitializationFailed(e.to_string()))?;

    let stat = aria2_client.get_global_stat().await?;
    Ok(stat)
}
