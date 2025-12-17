pub mod types;

use fit_launcher_scraping::structs::Game;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};
use uuid::Uuid;

use crate::api::types::InstallationJob;

pub type JobList = Arc<RwLock<HashMap<Uuid, Arc<InstallationJob>>>>;

pub struct InstallationManager {
    jobs: JobList,
}

impl InstallationManager {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_job(
        &self,
        game: Game,
        download_path: PathBuf,
        download_id: Option<Uuid>,
    ) -> Uuid {
        let id = Uuid::new_v4();
        let job = InstallationJob {
            id,
            download_id,
            cancel_emitter: CancellationToken::new(),
            game,
            path: download_path,
        };

        self.jobs.write().await.insert(id, Arc::new(job));

        id
    }

    pub async fn get_job(&self, id: Uuid) -> Option<Arc<InstallationJob>> {
        let list = self.jobs.read().await;
        list.get(&id).cloned()
    }

    /// List all jobs
    pub async fn list_jobs(&self) -> Vec<Arc<InstallationJob>> {
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

    /// Start a job
    pub async fn start_job(&self, id: Uuid, app_handle: tauri::AppHandle) {
        let job_opt = { self.jobs.read().await.get(&id).cloned() };
        let job = match job_opt {
            Some(j) => j,
            None => return,
        };
        info!("Starting auto installation: {}", &job.game.title);

        let result = job.auto_installation(app_handle, id).await;
        if let Err(e) = result {
            job.cancel_emitter.cancel();
            self.fail_job(id, e).await;
        }
    }

    pub async fn clean_job(&self, id: Uuid) {
        let job_opt = { self.jobs.read().await.get(&id).cloned() };
        let job = match job_opt {
            Some(j) => j,
            None => return,
        };
        info!(
            "Starting cleaning process for: {} on path: {}",
            &job.game.title,
            &job.path.to_str().unwrap_or("error")
        );
        if let Err(e) = job.clean_parts().await {
            error!("Error cleaning parts: {e:?}")
        }
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
