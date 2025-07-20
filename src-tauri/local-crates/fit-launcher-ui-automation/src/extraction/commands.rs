use std::path::PathBuf;

use specta::specta;
use tracing::info;

use crate::{
    errors::ExtractError, extract_multiple_files, find_first_rar_file,
    mighty_automation::windows_ui_automation::start_executable_components_args,
};
#[tauri::command]
#[specta]
pub fn extract_game(dir: PathBuf) -> Result<(), ExtractError> {
    let rar_file = find_first_rar_file(&dir).ok_or(ExtractError::NoRarFileFound)?;

    extract_multiple_files(&rar_file)?;
    Ok(())
}
