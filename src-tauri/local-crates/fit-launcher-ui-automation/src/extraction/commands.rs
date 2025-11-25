use std::{collections::HashMap, path::PathBuf};

use fit_launcher_scraping::structs::Game;
use specta::specta;
use tokio::task::JoinSet;
use tracing::info;

use crate::{auto_installation, errors::ExtractError, extract_archive};

fn sanitize_filename(input: &str) -> String {
    let invalid = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    input
        .chars()
        .filter(|c| !invalid.contains(c))
        .collect::<String>()
        .trim()
        .to_string()
}

#[tauri::command]
#[specta]
pub async fn extract_game(dir: PathBuf, game: Game, auto_clean: bool) -> Result<(), ExtractError> {
    let clean_title = sanitize_filename(&game.title);
    let folder_name = format!("{} [Fitgirl Repack]", clean_title);
    let target = dir.join(folder_name);

    let list = target.read_dir()?;
    let mut groups: HashMap<String, Vec<PathBuf>> = HashMap::new();
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
        groups
            .entry(group_name.to_owned())
            .or_default()
            .push(rar.path());
    }

    for rar_file in groups.values() {
        info!("Extracting {rar_file:?} in-place...");
        extract_archive(&rar_file[0])?;
    }

    if auto_clean {
        let mut taskset = JoinSet::new();
        for rar_file in groups.into_values().flatten() {
            taskset.spawn(tokio::fs::remove_file(rar_file));
        }
        taskset.join_all().await;
    }

    auto_installation(&target).await?;

    Ok(())
}
