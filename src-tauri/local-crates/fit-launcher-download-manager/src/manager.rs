use crate::aria2::Aria2WsClient;
use crate::debouncer::SaveDebouncer;
use crate::error::DownloadManagerError;
use crate::persistence::{load_jobs, save_jobs_atomic};
use crate::types::*;
use anyhow::{Context, Result};
use aria2_ws::response::{File, Status};
use chrono::Utc;
use fit_launcher_ddl::DirectLink;
use fit_launcher_scraping::structs::Game;
use fit_launcher_torrent::model::FileInfo;
use fit_launcher_torrent::{FitLauncherConfigAria2, LibrqbitSession};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
use tracing::{debug, error, info};

/// Debounce time for saving to disk
const SAVE_DEBOUNCE_MS: u64 = 400;

/// Download Manager
///
/// Note: Index were wrote to keep things fast for lookups and reconciling
///
/// If any contributor intends on adding something, please, make sure that you add an Index if needed.
pub struct DownloadManager {
    pub aria: Arc<tokio::sync::Mutex<Aria2WsClient>>,

    /// Lock order: read job data under jobs lock then immediatly release lock before RPC
    jobs: Arc<RwLock<HashMap<JobId, Job>>>,
    save: Arc<SaveDebouncer>,

    /// gid -> JobId index
    gid_index: RwLock<HashMap<Gid, JobId>>,
    /// infohash -> JobId index
    infohash_index: RwLock<HashMap<String, JobId>>,
    persist_path: PathBuf,
    tauri_handle: tauri::AppHandle,
    pub aria_cfg: FitLauncherConfigAria2,
    /// Librqbit session owned here to regenerate metadata when needed
    torrent_session: Arc<LibrqbitSession>,
}

//todo: make it DRY

impl DownloadManager {
    pub fn new(
        aria: Arc<tokio::sync::Mutex<Aria2WsClient>>,
        handle: tauri::AppHandle,
        aria_cfg: FitLauncherConfigAria2,
        librqbit_state: State<'_, LibrqbitSession>,
    ) -> Arc<Self> {
        let persist_path = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("manager.json");

        let jobs = Arc::new(RwLock::new(HashMap::new()));

        let save = SaveDebouncer::new(
            jobs.clone(),
            persist_path.clone(),
            Duration::from_millis(SAVE_DEBOUNCE_MS),
        );
        let librqbit_sess = Arc::new(librqbit_state.clone().inner().to_owned());
        Arc::new(Self {
            aria,
            jobs,
            save,
            gid_index: RwLock::new(HashMap::new()),
            infohash_index: RwLock::new(HashMap::new()),
            persist_path,
            tauri_handle: handle,
            aria_cfg,
            torrent_session: librqbit_sess,
        })
    }

    pub async fn request_save_debounced(&self) {
        self.save.request_save().await;
    }

    /// Load persisted jobs and rebuild indicess. (guys lock order: jobs -> gid_index -> infohash_index)
    pub async fn load_from_disk(self: &Arc<Self>) -> Result<()> {
        let map = load_jobs(&self.persist_path).await.context("load jobs")?;

        {
            let mut jobs_lock = self.jobs.write().await;
            let mut idx_lock = self.gid_index.write().await;
            let mut idx_hash = self.infohash_index.write().await;

            jobs_lock.clear();
            idx_lock.clear();
            idx_hash.clear();

            for (id, mut job) in map.into_iter() {
                job.state = DownloadState::Paused;
                job.status = None;
                job.metadata.updated_at = Utc::now();

                for g in job.gids.iter() {
                    idx_lock.insert(g.clone(), id.clone());
                }
                if let Some(t) = &job.torrent {
                    idx_hash.insert(t.info_hash.clone(), id.clone());
                }

                jobs_lock.insert(id.clone(), job);
            }
        }

        info!("Loaded {} jobs from disk", self.jobs.read().await.len());

        {
            let dm = Arc::clone(self);
            tokio::spawn(async move {
                let jobs_snapshot: Vec<(JobId, Vec<Gid>)> = {
                    let jobs = dm.jobs.read().await;
                    jobs.iter()
                        .map(|(id, job)| (id.clone(), job.gids.clone()))
                        .collect()
                };

                for (_id, gids) in jobs_snapshot {
                    for gid in gids {
                        let aria_guard = dm.aria.lock().await;
                        if let Err(e) = aria_guard.pause(&gid).await {
                            error!("Failed to pause gid {} during load: {:?}", gid, e);
                        }
                        // small yield to avoid hammering aria2 in busy startup scenarios
                        tokio::task::yield_now().await;
                    }
                }
            });
        }

        Ok(())
    }

    /// Immediate save (no debounce) safe to call from anywhere.
    pub async fn save_now(&self) -> Result<()> {
        let snapshot: HashMap<_, _> = self.jobs.read().await.clone();
        save_jobs_atomic(self.persist_path.clone(), &snapshot)
            .await
            .context("save jobs")?;
        Ok(())
    }

    pub async fn add_ddl_job(
        self: &Arc<Self>,
        files: Vec<DirectLink>,
        target: PathBuf,
        game: Game,
    ) -> Result<JobId> {
        let clean_title = Self::sanitize_filename(&game.title);
        let folder_name = format!("{} [Fitgirl Repack]", clean_title);
        let dir = target.join(folder_name);

        let mut job = Job::new_ddl(files.clone(), target.clone(), game, dir.clone());

        // prepare add_uri calls with cfg (do RPC calls outside of job locks plz)
        let cfg = self.aria_cfg.clone();

        let dir_str = Some(dir.to_string_lossy().to_string());

        let mut gids: Vec<String> = Vec::with_capacity(files.len());
        for f in files.iter() {
            let filename = f.filename.clone();
            let url = f.url.clone();
            let aria_guard = self.aria.lock().await;
            let gid = aria_guard
                .add_uri(vec![url], dir_str.clone(), Some(filename), cfg.clone())
                .await?;
            gids.push(gid);
        }
        info!("All direct links have successfully start !");

        // register job & indices
        job.gids = gids.clone();
        job.state = DownloadState::Active;
        job.metadata.updated_at = Utc::now();

        {
            // again (srry it's annoying but it's very important to keep the same lock order to avoid any infinite lock) maintain lock order: jobs -> gid_index -> infohash_index
            let mut jobs = self.jobs.write().await;
            let mut gid_idx = self.gid_index.write().await;
            for g in gids.iter() {
                gid_idx.insert(g.clone(), job.id.clone());
            }
            jobs.insert(job.id.clone(), job.clone());
        }

        let _ = self.tauri_handle.emit("download::job_updated", job.clone());

        self.request_save_debounced().await;
        Ok(job.id)
    }

    pub async fn add_torrent_job(
        self: &Arc<Self>,
        magnet: String,
        files_list: Vec<usize>,
        target: PathBuf,
        game: Game,
    ) -> Result<JobId> {
        let meta = self
            .torrent_session
            .get_metadata_only(magnet.clone())
            .await
            .context("librqbit: get metadata")?;

        let bytes = meta.torrent_bytes.to_vec();

        let info_hash = meta.info_hash.clone().as_string();
        let mut files = Vec::new();
        if let Some(multi) = &meta.info.files {
            for (i, file) in multi.iter().enumerate() {
                let file_path = file
                    .path
                    .iter()
                    .map(|part| std::str::from_utf8(part).unwrap_or("<invalid utf8>"))
                    .collect::<std::path::PathBuf>();

                files.push(FileInfo {
                    file_name: file_path,
                    length: file.length,
                    file_index: i,
                });
            }
        } else if let Some(length) = meta.info.length {
            let file_name = meta
                .info
                .name
                .as_ref()
                .map(|name_bytes| std::str::from_utf8(name_bytes).unwrap_or("unnamed"))
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("unnamed"));

            files.push(FileInfo {
                file_name,
                length,
                file_index: 0,
            });
        }

        let selected_files: Vec<FileInfo> = files_list
            .iter()
            .filter_map(|&i| files.get(i).cloned())
            .collect();

        let job_path = meta
            .output_folder
            .file_name()
            .expect("invalid output_folder: no last component");

        let mut job = Job::new_torrent(
            bytes.clone(),
            files_list.clone(),
            info_hash.clone(),
            magnet.clone(),
            target.clone(),
            target.join(job_path),
            selected_files,
            game,
        );

        let dir = Some(target.to_string_lossy().to_string());

        let _cfg = self.aria_cfg.clone();
        let aria_guard = self.aria.lock().await;

        let gid = aria_guard
            .add_torrent(bytes.clone(), dir.clone(), files_list.clone())
            .await?;

        job.gids = vec![gid.clone()];
        job.state = DownloadState::Active;
        job.metadata.updated_at = Utc::now();

        {
            let mut jobs = self.jobs.write().await;
            let mut gid_idx = self.gid_index.write().await;
            gid_idx.insert(gid.clone(), job.id.clone());
            if let Some(t) = &job.torrent {
                let mut idx_hash = self.infohash_index.write().await;
                idx_hash.insert(t.info_hash.clone(), job.id.clone());
            }
            jobs.insert(job.id.clone(), job.clone());
        }

        let _ = self.tauri_handle.emit("download::job_updated", job.clone());
        self.request_save_debounced().await;
        Ok(job.id)
    }

    pub async fn pause(&self, job_id: &str) -> Result<()> {
        // clone gids while holding the job lock, then do RPC outside
        let gids: Option<Vec<Gid>> = {
            let mut jobs = self.jobs.write().await;
            if let Some(job) = jobs.get_mut(job_id) {
                let g = job.gids.clone();
                job.state = DownloadState::Paused;
                job.status = None;
                job.metadata.updated_at = Utc::now();
                let _ = self.tauri_handle.emit("download::job_updated", job.clone());

                self.request_save_debounced().await;
                Some(g)
            } else {
                None
            }
        };

        if let Some(gids) = gids {
            for gid in gids {
                let aria_guard = self.aria.lock().await;
                if let Err(e) = aria_guard.pause(&gid).await {
                    error!("aria pause failed for gid {}: {:?}", gid, e);
                }
            }
        }

        Ok(())
    }

    #[allow(unused)]
    pub async fn resume(self: &Arc<Self>, job_id: &str) -> Result<()> {
        // We'll follow lock order AGAIN: read job metadata under jobs lock then release lock before RPC.
        // Acquire a clone of the job to operate on, but keep a marker that we will update the real job later. This was decided to avoid any heavy locking.
        let job_opt = {
            let jobs = self.jobs.read().await;
            jobs.get(job_id).cloned()
        };

        let job = match job_opt {
            Some(j) => j,
            None => return Ok(()),
        };

        let mut any_resumed = false;
        let mut need_respawn = false;

        for gid in job.gids.clone() {
            let aria_guard = self.aria.lock().await;
            match aria_guard.resume(&gid).await {
                Ok(_) => any_resumed = true,
                Err(e) => {
                    error!("Failed to resume gid {}: {:?}", gid, e);
                    need_respawn = true;
                }
            }
        }

        if any_resumed {
            let mut jobs_lock = self.jobs.write().await;
            if let Some(j) = jobs_lock.get_mut(job_id) {
                j.state = DownloadState::Active;
                j.metadata.updated_at = Utc::now();
                let _ = self.tauri_handle.emit("download::job_updated", j.clone());
            }
            self.request_save_debounced().await;
            return Ok(());
        }

        match job.source {
            DownloadSource::Ddl => self.resume_ddl(&job).await?,
            DownloadSource::Torrent => self.resume_torrent(&job).await?,
        }

        Ok(())
    }

    async fn resume_ddl(&self, job: &Job) -> Result<()> {
        if let Some(ddl) = &job.ddl {
            let cfg = self.aria_cfg.clone();
            let dir = Some(job.metadata.target_path.to_string_lossy().to_string());
            let mut new_gids = Vec::with_capacity(ddl.files.len());

            for f in ddl.files.iter() {
                let aria_guard = self.aria.lock().await;
                match aria_guard
                    .add_uri(
                        vec![f.url.clone()],
                        dir.clone(),
                        Some(f.filename.clone()),
                        cfg.clone(),
                    )
                    .await
                {
                    Ok(gid) => new_gids.push(gid),
                    Err(e) => error!("Failed to respawn DDL gid for {}: {:?}", job.id, e),
                }
            }

            if !new_gids.is_empty() {
                let mut jobs = self.jobs.write().await;
                if let Some(j) = jobs.get_mut(&job.id) {
                    j.gids.extend(new_gids.iter().cloned());
                    j.gids.sort();
                    j.gids.dedup();

                    let mut gid_idx = self.gid_index.write().await;
                    for g in j.gids.iter() {
                        gid_idx.insert(g.clone(), j.id.clone());
                    }

                    j.state = DownloadState::Active;
                    j.metadata.updated_at = Utc::now();
                    let _ = self.tauri_handle.emit("download::job_updated", j.clone());
                }
                self.request_save_debounced().await;
            }
        }
        Ok(())
    }

    async fn resume_torrent(&self, job: &Job) -> Result<()> {
        let torrent_bytes = if let Some(t) = &job.torrent {
            Some(t.torrent_bytes.clone())
        } else {
            None
        };

        let magnet = job.torrent.as_ref().map(|t| t.magnet.clone());
        let files_list = job
            .torrent
            .as_ref()
            .map(|t| t.file_indices.clone())
            .unwrap_or_default();
        let dir = Some(job.metadata.target_path.to_string_lossy().to_string());

        let torrent_bytes = match torrent_bytes {
            Some(b) => b,
            None => {
                if let Some(m) = magnet.clone() {
                    match self.torrent_session.get_metadata_only(m.clone()).await {
                        Ok(meta) => meta.torrent_bytes.to_vec(),
                        Err(e) => {
                            error!("Cannot regenerate torrent for job {}: {:?}", job.id, e);
                            return Err(DownloadManagerError::TorrentInitError(format!(
                                "No torrent bytes available to respawn job {}",
                                job.id
                            ))
                            .into());
                        }
                    }
                } else {
                    error!("No torrent bytes or magnet for job {}", job.id);
                    return Err(DownloadManagerError::TorrentInitError(format!(
                        "No torrent bytes available to respawn job {}",
                        job.id
                    ))
                    .into());
                }
            }
        };

        let aria_guard = self.aria.lock().await;
        match aria_guard.add_torrent(torrent_bytes, dir, files_list).await {
            Ok(new_gid) => {
                let mut jobs = self.jobs.write().await;
                if let Some(j) = jobs.get_mut(&job.id) {
                    j.gids = vec![new_gid.clone()];
                    j.state = DownloadState::Active;
                    j.metadata.updated_at = Utc::now();
                    let mut gid_idx = self.gid_index.write().await;
                    gid_idx.insert(new_gid, j.id.clone());
                    if let Some(t) = &j.torrent {
                        let mut ih = self.infohash_index.write().await;
                        ih.insert(t.info_hash.clone(), j.id.clone());
                    }
                    let _ = self.tauri_handle.emit("download::job_updated", j.clone());
                }
                self.request_save_debounced().await;
            }
            Err(e) => {
                error!("Failed to respawn torrent for job {}: {:?}", job.id, e);
                return Err(e.into());
            }
        }

        Ok(())
    }

    pub async fn remove(&self, job_id: &str) -> Result<()> {
        // Remove job under lock and capture gids to remove outside
        let gids_opt: Option<Vec<Gid>> = {
            let mut jobs = self.jobs.write().await;
            if let Some(job) = jobs.remove(job_id) {
                let gids = job.gids.clone();

                let mut gid_idx = self.gid_index.write().await;
                for gid in gids.iter() {
                    gid_idx.remove(gid);
                }
                if let Some(t) = job.torrent {
                    let mut ih = self.infohash_index.write().await;
                    ih.remove(&t.info_hash);
                }
                let _ = self
                    .tauri_handle
                    .emit("download::job_removed", job_id.to_string());
                Some(gids)
            } else {
                None
            }
        };

        if let Some(gids) = gids_opt {
            for gid in gids {
                let aria_guard = self.aria.lock().await;
                if let Err(e) = aria_guard.remove(&gid).await {
                    error!("Failed to remove gid {} from aria2: {:?}", gid, e);
                }
            }
            self.request_save_debounced().await;
        }

        Ok(())
    }

    pub async fn apply_status_raw(&self, gid: &str, raw: Value) -> Result<()> {
        let fs = Self::file_status_from_raw(&raw);

        let job_id_opt = {
            let idx = self.gid_index.read().await;
            idx.get(gid).cloned()
        };

        if let Some(job_id) = job_id_opt {
            let mut job_infohash_to_insert: Option<(String, JobId)> = None;

            {
                let mut jobs = self.jobs.write().await;
                if let Some(job) = jobs.get_mut(&job_id) {
                    let mut agg = job.status.clone().unwrap_or_default();

                    agg.per_file.insert(gid.to_string(), fs.clone());

                    agg.total_length = agg.per_file.values().map(|s| s.total_length).sum();
                    agg.completed_length = agg.per_file.values().map(|s| s.completed_length).sum();
                    agg.download_speed = agg.per_file.values().map(|s| s.download_speed).sum();
                    agg.upload_speed = agg.per_file.values().map(|s| s.upload_speed).sum();

                    agg.progress_percentage = if agg.total_length > 0 {
                        (agg.completed_length as f64 / agg.total_length as f64) * 100.0
                    } else {
                        0.0
                    };

                    let all_complete = agg
                        .per_file
                        .values()
                        .all(|s| s.status == DownloadState::Complete);
                    let any_active = agg
                        .per_file
                        .values()
                        .any(|s| s.status == DownloadState::Active);
                    let any_paused = agg.per_file.values().any(|s| {
                        s.status == DownloadState::Paused || s.status == DownloadState::Waiting
                    });

                    agg.state = if all_complete {
                        DownloadState::Complete
                    } else if any_active {
                        DownloadState::Active
                    } else if any_paused {
                        DownloadState::Paused
                    } else {
                        DownloadState::Waiting
                    };

                    job.status = Some(agg.clone());
                    job.state = agg.state.clone();
                    job.metadata.updated_at = Utc::now();

                    if let Some(info_hash) = fs.info_hash.clone() {
                        if let Some(t) = job.torrent.as_mut() {
                            t.info_hash = info_hash.clone();
                            job_infohash_to_insert = Some((info_hash, job.id.clone()));
                        } else {
                            // oprphan job
                            job.torrent = Some(TorrentJob {
                                torrent_bytes: Vec::new(),
                                file_indices: Vec::new(),
                                info_hash: info_hash.clone(),
                                torrent_files: Vec::new(),
                                magnet: String::new(),
                            });
                            job_infohash_to_insert = Some((info_hash, job.id.clone()));
                        }
                    }
                } else {
                    let mut idx = self.gid_index.write().await;
                    idx.remove(gid);
                }
            }

            if let Some((h, id)) = job_infohash_to_insert {
                let mut ih = self.infohash_index.write().await;
                ih.insert(h, id);
            }

            {
                let mut gid_idx = self.gid_index.write().await;
                gid_idx.insert(gid.to_string(), job_id.clone());
            }

            let job_snapshot_opt = {
                let jobs = self.jobs.read().await;
                jobs.get(&job_id).cloned()
            };

            if let Some(js) = job_snapshot_opt {
                let _ = self.tauri_handle.emit("download::job_updated", js.clone());

                if matches!(js.state, DownloadState::Complete)
                    || js
                        .status
                        .as_ref()
                        .map(|s| s.completed_length >= s.total_length)
                        .unwrap_or(false)
                {
                    let _ = self
                        .tauri_handle
                        .emit("download::job_completed", js.clone());
                }
            }

            self.request_save_debounced().await;
        } else {
            // This can happen for stale GIDs from completed/removed downloads
            debug!("Received update for unknown gid: {}", gid);
        }

        Ok(())
    }

    /// Convert an aria2 Status update vector into calls to apply_status_raw
    pub async fn on_aria2_update(&self, statuses: Vec<Status>) {
        for status in statuses.into_iter() {
            let mut m = serde_json::Map::new();
            m.insert(
                "gid".to_string(),
                serde_json::Value::String(status.gid.clone()),
            );
            m.insert(
                "status".to_string(),
                serde_json::Value::String(status.status.into()),
            );
            m.insert(
                "totalLength".to_string(),
                serde_json::Value::String(status.total_length.to_string()),
            );
            m.insert(
                "completedLength".to_string(),
                serde_json::Value::String(status.completed_length.to_string()),
            );
            m.insert(
                "downloadSpeed".to_string(),
                serde_json::Value::String(status.download_speed.to_string()),
            );
            m.insert(
                "uploadSpeed".to_string(),
                serde_json::Value::String(status.upload_speed.to_string()),
            );
            let percentage = if status.total_length > 0 {
                (status.completed_length as f64 / status.total_length as f64) * 100.0
            } else {
                0.8
            };
            m.insert(
                "progressPercentage".to_string(),
                serde_json::Value::String(percentage.to_string()),
            );
            if let Some(info_hash) = &status.info_hash {
                m.insert(
                    "infoHash".to_string(),
                    serde_json::Value::String(info_hash.clone()),
                );
            }
            // files -> we can drop them as `file` conversion expects the array items
            if !status.files.is_empty()
                && let Ok(arr) = serde_json::to_value(&status.files)
            {
                m.insert("files".to_string(), arr);
            }

            let raw = serde_json::Value::Object(m);
            if let Err(e) = self.apply_status_raw(&status.gid, raw).await {
                error!("apply_status_raw failed for gid {}: {:?}", status.gid, e);
            }
        }
    }

    /// Convert raw JSON-ish value to FileStatus
    fn file_status_from_raw(raw: &Value) -> FileStatus {
        let gid = raw
            .get("gid")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let status: DownloadState = raw
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| s.into())
            .unwrap_or(DownloadState::Waiting);
        let total_length = raw
            .get("totalLength")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let completed_length = raw
            .get("completedLength")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let download_speed = raw
            .get("downloadSpeed")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let upload_speed = raw
            .get("uploadSpeed")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let files: Vec<File> = raw
            .get("files")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect()
            })
            .unwrap_or_default();
        let info_hash = raw
            .get("infoHash")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        FileStatus {
            gid,
            status,
            total_length,
            completed_length,
            download_speed,
            upload_speed,
            files,
            info_hash,
        }
    }

    fn sanitize_filename(input: &str) -> String {
        let invalid = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
        input
            .chars()
            .filter(|c| !invalid.contains(c))
            .collect::<String>()
            .trim()
            .to_string()
    }

    /// Return a snapshot of all jobs
    pub async fn all_jobs(&self) -> Vec<Job> {
        self.jobs.read().await.values().cloned().collect()
    }
}
