use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::Aria2Error;

#[derive(Debug, Default, Serialize, Deserialize, Type)]
pub struct AriaTask {
    pub gid: String,
    pub filename: String,
}

#[derive(Debug, Default, Serialize, Deserialize, Type)]
pub struct AriaTaskProgress {
    pub completed: u32,
    pub download_speed: u64,
    pub total_length: u64,
    pub completed_length: u64,
}

#[derive(Debug, Default, Serialize, Deserialize, Type)]
pub struct AriaTaskResult {
    pub task: Option<AriaTask>,
    pub error: Option<Aria2Error>,
}
