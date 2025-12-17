use std::path::PathBuf;

use std::time::{SystemTime, UNIX_EPOCH};
use std::{fs, io};

use serde::{Deserialize, Serialize};
use specta::Type;
use tracing::error;

fn ensure_path(path: &PathBuf, is_file: bool) {
    if is_file {
        if let Some(parent) = path.parent()
            && let Err(e) = fs::create_dir_all(parent)
        {
            error!("Failed to create parent directories: {e}");
        }
        if !path.exists()
            && let Err(e) = fs::File::create(path)
        {
            error!("Failed to create file {}: {e}", path.display());
        }
    } else if let Err(e) = fs::create_dir_all(path) {
        error!("Failed to create directory: {e}");
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum ExclusionAction {
    Add(String),
    Remove(String),
}

impl std::fmt::Display for ExclusionAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Add(p) => write!(f, "Add: {p}"),
            Self::Remove(p) => write!(f, "Remove: {p}"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderExclusionEntry {
    pub action: ExclusionAction,
    pub timestamp_utc: i64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct FolderExclusionsFile {
    pub entries: Vec<FolderExclusionEntry>,
}

pub(crate) fn now_utc() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

pub(crate) fn load_exclusions(path: &PathBuf) -> FolderExclusionsFile {
    if !path.exists() {
        return FolderExclusionsFile::default();
    }

    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub(crate) fn save_exclusions(path: &PathBuf, data: &FolderExclusionsFile) -> io::Result<()> {
    ensure_path(path, true);

    let tmp = path.with_extension("tmp");
    let json = serde_json::to_string_pretty(data).unwrap();

    fs::write(&tmp, json)?;
    fs::rename(tmp, path)?;
    Ok(())
}
