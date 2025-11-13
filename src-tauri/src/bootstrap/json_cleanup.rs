use anyhow::Result;
use serde_json::Value;
use std::error::Error;
use std::fs;
use std::path::Path;
use tauri::Manager;
use tracing::{error, warn};

pub fn delete_invalid_json_files(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn Error>> {
    let mut dir_path = app_handle.path().app_data_dir().unwrap();
    dir_path.push("tempGames");

    if !dir_path.exists() {
        tracing::info!("Directory does not exist: {:?}", dir_path);
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Directory not found",
        )));
    }

    for entry in fs::read_dir(dir_path)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Err(e) = check_file_for_tags(&path) {
                error!("Error processing file {:?}: {}", path, e);
            }
        }
    }

    Ok(())
}

fn check_file_for_tags(path: &Path) -> Result<(), Box<dyn Error>> {
    let file_content = fs::read_to_string(path)?;
    let json: Value = serde_json::from_str(&file_content)?;

    if let Some(arr) = json.as_array() {
        for obj in arr {
            if obj.get("tag").is_none() {
                warn!(
                    "Missing 'tag' key in file: {:?}, removing to rebuild...",
                    path
                );
                fs::remove_file(path)?;
            }
        }
    }

    Ok(())
}
