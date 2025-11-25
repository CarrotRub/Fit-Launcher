use std::{collections::HashMap, path::PathBuf};

use fit_launcher_scraping::structs::Game;
use specta::specta;
use tracing::info;

use crate::{auto_installation, errors::ExtractError, extract_archive};

#[tauri::command]
#[specta]
pub async fn extract_game(job_path: PathBuf) -> Result<(), ExtractError> {
    let list = job_path.read_dir()?;
    let mut groups = HashMap::new();
    for rar in list.flatten() {
        if rar.metadata()?.is_dir() {
            continue;
        }

        let rar_name = rar.file_name();
        let rar_name = rar_name.to_string_lossy();
        if !rar_name.ends_with(".rar") {
            continue;
        }

        let group_name = rar_name
            .split_once(".part")
            .map(|(group, _)| group)
            .unwrap_or(&*rar_name);
        groups.entry(group_name.to_owned()).or_insert(rar.path());
    }

    for rar_file in groups.values() {
        info!("Extracting {rar_file:?} in-place...");
        extract_archive(&rar_file)?;
    }

    auto_installation(&job_path).await?;

    Ok(())
}
