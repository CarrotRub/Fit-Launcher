use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, specta::Type, PartialEq, Eq, Clone)]
pub struct FileInfo {
    pub file_name: PathBuf,
    pub length: u64,
    pub file_index: usize,
}
