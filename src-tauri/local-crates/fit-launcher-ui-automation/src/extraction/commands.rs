use std::{collections::HashMap, path::PathBuf};

use fit_launcher_scraping::structs::Game;
use specta::specta;
use tracing::info;

use crate::{errors::ExtractError, extract_archive};
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
pub fn extract_game(dir: PathBuf, game: Game) -> Result<(), ExtractError> {
    let clean_title = sanitize_filename(&game.title);
    let folder_name = format!("{} [Fitgirl Repack]", clean_title);
    let target = dir.join(folder_name);

    let list = target.read_dir()?;
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
        extract_archive(&rar_file)?;
    }

    Ok(())
}
