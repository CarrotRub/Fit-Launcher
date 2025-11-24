use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio::time::{Duration, sleep};
use tracing::error;

use crate::persistence::save_jobs_atomic;
use crate::types::{Job, JobId};
use std::collections::HashMap;
use std::path::PathBuf;

pub struct SaveDebouncer {
    delay: Duration,
    pending: Mutex<Option<JoinHandle<()>>>,
    jobs: Arc<tokio::sync::RwLock<HashMap<JobId, Job>>>,
    path: PathBuf,
}

impl SaveDebouncer {
    pub fn new(
        jobs: Arc<tokio::sync::RwLock<HashMap<JobId, Job>>>,
        path: PathBuf,
        delay: Duration,
    ) -> Arc<Self> {
        Arc::new(Self {
            delay,
            pending: Mutex::new(None),
            jobs,
            path,
        })
    }

    pub async fn request_save(self: &Arc<Self>) {
        if let Some(handle) = self.pending.lock().await.take() {
            handle.abort();
        }

        let this = Arc::clone(self);

        let handle = tokio::spawn(async move {
            sleep(this.delay).await;

            let snapshot = this.jobs.read().await.clone();

            if let Err(e) = save_jobs_atomic(this.path.clone(), &snapshot).await {
                error!("FATAL: failed to save jobs: {:?}", e);
            }
        });

        *self.pending.lock().await = Some(handle);
    }
}
