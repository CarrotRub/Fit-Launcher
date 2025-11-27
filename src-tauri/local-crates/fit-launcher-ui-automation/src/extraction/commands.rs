use std::{collections::HashMap, path::PathBuf};

use specta::specta;
use tokio::task::JoinSet;
use tracing::info;

use crate::{auto_installation, errors::ExtractError, extract_archive};

#[tauri::command]
#[specta]
pub async fn extract_game(job_path: PathBuf, auto_clean: bool) -> Result<(), ExtractError> {
    let list = job_path.read_dir()?;
    let mut groups: HashMap<String, Vec<PathBuf>> = HashMap::new();
    for entry in list.flatten() {
        if entry.metadata()?.is_dir() {
            continue;
        }

        let name = entry.file_name();
        let name = name.to_string_lossy();

        if !name.ends_with(".rar") {
            continue;
        }

        let group = name
            .split_once(".part")
            .map(|(group, _)| group)
            .unwrap_or(&*name);

        groups.entry(group.into()).or_default().push(entry.path());
    }

    for (_group, paths) in &groups {
        let Some(first) = paths.first() else {
            continue;
        };
        info!("Extracting {first:?} in-place...");
        extract_archive(&first)?;
    }

    auto_installation(&job_path).await?;

    if auto_clean {
        let mut set = JoinSet::new();
        for rar in groups.into_values().flatten() {
            set.spawn(tokio::fs::remove_file(rar));
        }
        set.join_all().await;
    }

    Ok(())
}
