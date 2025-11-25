use std::{collections::HashMap, path::PathBuf};

use fit_launcher_scraping::structs::Game;
use specta::specta;
use tokio::task::JoinSet;
use tracing::info;

use crate::{auto_installation, errors::ExtractError, extract_archive};

#[tauri::command]
#[specta]
pub async fn extract_game(job_path: PathBuf) -> Result<(), ExtractError> {
    let list = job_path.read_dir()?;
    let mut groups = HashMap::new();
    for entry in list.flatten() {
        if entry.metadata()?.is_dir() {
            continue;
        }

        let name = entry.file_name();
        let name = name.to_string_lossy();

        if !name.ends_with(".rar") {
            continue;
        }

        let (group, part_num) = {
            // Case 1: pattern ".part1.N.rar"
            if let Some((g, p)) = name.split_once(".part1.") {
                let n = p
                    .trim_end_matches(".rar")
                    .parse::<u32>()
                    .unwrap_or(u32::MAX);
                (g.to_owned(), n)
            }
            // Case 2: pattern ".partN.rar"
            else if let Some((g, p)) = name.rsplit_once(".part") {
                let n = p
                    .trim_end_matches(".rar")
                    .parse::<u32>()
                    .unwrap_or(u32::MAX);
                (g.to_owned(), n)
            }
            // Case 3: single file
            else {
                (name.to_string(), 0)
            }
        };

        groups
            .entry(group)
            .and_modify(|(existing_num, _existing_path)| {
                if part_num < *existing_num {
                    *existing_num = part_num;
                }
            })
            .or_insert((part_num, entry.path()));
    }

    for (_group, (_num, path)) in groups {
        info!("Extracting {path:?} in-place...");
        extract_archive(&path)?;
    }

    auto_installation(&job_path).await?;

    Ok(())
}
