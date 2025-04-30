use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Task {
    pub gid: String,
    pub filename: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]

pub struct TaskProgress {
    pub completed: u32,
    pub download_speed: u64,
    pub total_length: u64,
    pub completed_length: u64,
}
