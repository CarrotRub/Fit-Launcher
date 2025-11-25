use aria2_ws::response::{File, TaskStatus};
use chrono::{DateTime, Utc};
use fit_launcher_ddl::DirectLink;
use fit_launcher_scraping::structs::Game;
use fit_launcher_torrent::model::FileInfo;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

pub type JobId = String;
pub type Gid = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
pub enum DownloadSource {
    Ddl,
    Torrent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "kebab-case")]
#[derive(Default)]
pub enum DownloadState {
    Active,
    #[default]
    Paused,
    Waiting,
    Error,
    Complete,
    Installing,
    Removed,
}

impl From<TaskStatus> for DownloadState {
    fn from(value: TaskStatus) -> Self {
        match value {
            TaskStatus::Active => DownloadState::Active,
            TaskStatus::Waiting => DownloadState::Waiting,
            TaskStatus::Paused => DownloadState::Paused,
            TaskStatus::Error => DownloadState::Error,
            TaskStatus::Removed => DownloadState::Removed,
            TaskStatus::Complete => DownloadState::Complete,
        }
    }
}

impl From<&str> for DownloadState {
    fn from(value: &str) -> Self {
        match value {
            "active" => DownloadState::Active,
            "waiting" => DownloadState::Waiting,
            "paused" => DownloadState::Paused,
            "error" => DownloadState::Error,
            "removed" => DownloadState::Removed,
            "complete" => DownloadState::Complete,
            _ => DownloadState::Waiting,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
pub struct FileStatus {
    pub gid: Option<Gid>,
    pub status: DownloadState,
    pub total_length: u64,
    pub completed_length: u64,
    pub download_speed: u64,
    pub upload_speed: u64,
    pub files: Vec<File>,
    pub info_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
pub struct AggregatedStatus {
    pub total_length: u64,
    pub completed_length: u64,
    pub download_speed: u64,
    pub upload_speed: u64,
    pub per_file: HashMap<Gid, FileStatus>,
    pub state: DownloadState,
    pub progress_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TorrentJob {
    pub torrent_bytes: Vec<u8>,
    pub file_indices: Vec<usize>,
    pub torrent_files: Vec<FileInfo>,
    pub info_hash: String,
    pub magnet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct JobMetadata {
    pub game_title: String,
    pub target_path: PathBuf,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DdlJob {
    pub files: Vec<DirectLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Job {
    pub id: JobId,

    pub metadata: JobMetadata,
    pub game: Game,

    pub job_path: PathBuf,

    pub source: DownloadSource,
    pub gids: Vec<Gid>,

    pub ddl: Option<DdlJob>,
    pub torrent: Option<TorrentJob>,

    pub state: DownloadState,
    pub status: Option<AggregatedStatus>,
}

impl Job {
    pub fn new_ddl(
        ddl_files: Vec<DirectLink>,
        target_path: PathBuf,
        game: Game,
        job_path: PathBuf,
    ) -> Self {
        let now = Utc::now();

        Job {
            id: Uuid::new_v4().to_string(),
            source: DownloadSource::Ddl,
            gids: vec![],
            job_path,
            ddl: Some(DdlJob { files: ddl_files }),
            torrent: None,

            metadata: JobMetadata {
                game_title: game.title.clone(),
                target_path,
                created_at: now,
                updated_at: now,
            },
            game,

            state: DownloadState::Waiting,
            status: None,
        }
    }

    pub fn new_torrent(
        bytes: Vec<u8>,
        file_indices: Vec<usize>,
        info_hash: String,
        magnet: String,
        target_path: PathBuf,
        job_path: PathBuf,
        torrent_files: Vec<FileInfo>,
        game: Game,
    ) -> Self {
        let now = Utc::now();

        Job {
            id: Uuid::new_v4().to_string(),
            source: DownloadSource::Torrent,
            gids: vec![],
            job_path,
            ddl: None,
            torrent: Some(TorrentJob {
                torrent_bytes: bytes,
                file_indices,
                info_hash,
                torrent_files,
                magnet,
            }),

            metadata: JobMetadata {
                game_title: game.title.clone(),
                target_path,
                created_at: now,
                updated_at: now,
            },
            game,

            state: DownloadState::Waiting,
            status: None,
        }
    }
}
