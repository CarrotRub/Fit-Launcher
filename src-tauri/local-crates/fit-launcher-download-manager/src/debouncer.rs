use crate::persistence::save_jobs_atomic;
use crate::types::{Job, JobId};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{RwLock, watch};
use tokio::time::{Duration, sleep};
use tracing::error;

pub struct SaveDebouncer {
    tx: watch::Sender<()>,
}

impl SaveDebouncer {
    pub fn new(
        jobs: Arc<RwLock<HashMap<JobId, Job>>>,
        path: PathBuf,
        delay: Duration,
    ) -> Arc<Self> {
        let (tx, mut rx) = watch::channel(());

        tokio::spawn(async move {
            loop {
                if rx.changed().await.is_err() {
                    break;
                }

                loop {
                    tokio::select! {
                        _ = sleep(delay) => break,
                        result = rx.changed() => {
                            if result.is_err() { return; }
                        }
                    }
                }

                let snapshot = jobs.read().await.clone();
                if let Err(e) = save_jobs_atomic(path.clone(), &snapshot).await {
                    error!("FATAL: failed to save jobs: {:?}", e);
                }
            }
        });

        Arc::new(Self { tx })
    }

    pub async fn request_save(self: &Arc<Self>) {
        let _ = self.tx.send(());
    }
}
