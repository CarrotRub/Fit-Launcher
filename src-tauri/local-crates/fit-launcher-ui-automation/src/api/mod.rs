pub mod types;

use fit_launcher_scraping::structs::Game;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;
use tracing::error;
use uuid::Uuid;

use crate::api::types::InstallationJob;

pub type JobList = Arc<RwLock<HashMap<Uuid, InstallationJob>>>;

pub struct InstallationManager {
    jobs: JobList,
}

impl InstallationManager {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_job(&self, game: Game, download_path: PathBuf) -> Uuid {
        let id = Uuid::new_v4();
        let job = InstallationJob {
            id,
            cancel_emitter: CancellationToken::new(),
            game,
            path: download_path,
        };

        self.jobs.write().await.insert(id, job);

        id
    }

    /// List all jobs
    pub async fn list_jobs(&self) -> Vec<InstallationJob> {
        let jobs = self.jobs.read().await;
        jobs.values().cloned().collect()
    }

    /// Get the underlying job map
    pub async fn list(&self) -> JobList {
        self.jobs.clone()
    }

    /// Get the cancellation token for a job
    pub async fn get_cancellation_token(&self, id: Uuid) -> Option<CancellationToken> {
        let list = self.jobs.read().await;
        list.get(&id).map(|job| job.cancel_emitter.clone())
    }

    /// Get the game for a job
    pub async fn get_game(&self, id: Uuid) -> Option<Game> {
        let list = self.jobs.read().await;
        list.get(&id).map(|job| job.game.clone())
    }

    /// Cancel a job emitter via its cancellation token
    pub async fn cancel_emitter(&self, id: Uuid) {
        if let Some(token) = self.get_cancellation_token(id).await {
            token.cancel();
        }
    }

    /// Remove a job from the list
    pub async fn remove(&self, id: Uuid) {
        self.jobs.write().await.remove(&id);
    }

    /// Fail a job: log error, cancel, and remove
    pub async fn fail_job(&self, id: Uuid, err: impl std::fmt::Display) {
        error!("Job {id} failed: {err}");
        self.cancel_emitter(id).await;
        self.remove(id).await;
    }

    /// Start a job in a separate task with automatic error handling
    pub async fn start_job(&self, id: Uuid, app_handle: tauri::AppHandle) {
        let job_opt = {
            let jobs = self.jobs.read().await;
            jobs.get(&id).cloned()
        };

        let job = match job_opt {
            Some(job) => job,
            None => return,
        };

        let manager = self.clone();
        let token = job.cancel_emitter.clone();

        tokio::spawn(async move {
            let result = job.auto_installation(app_handle).await;

            if let Err(e) = result {
                // Cancel and remove the job on failure
                token.cancel();
                manager.fail_job(id, e).await;
            }
        });
    }
}

impl Clone for InstallationManager {
    fn clone(&self) -> Self {
        Self {
            jobs: self.jobs.clone(),
        }
    }
}

impl Default for InstallationManager {
    fn default() -> Self {
        Self::new()
    }
}
