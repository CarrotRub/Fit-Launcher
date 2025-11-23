use crate::types::{Job, JobId};
use anyhow::Result;
use serde_json;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

pub async fn save_jobs_atomic(path: PathBuf, jobs: &HashMap<JobId, Job>) -> Result<()> {
    let tmp = path.with_extension("tmp");
    // Serialize on blocking thread to avoid tokio blocking
    let bytes = tokio::task::spawn_blocking({
        let jobs = jobs.clone();
        move || serde_json::to_vec_pretty(&jobs)
    })
    .await??;

    tokio::task::spawn_blocking(move || -> Result<(), anyhow::Error> {
        let mut f = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&tmp)?;
        f.write_all(&bytes)?;
        f.sync_all()?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    })
    .await??;

    Ok(())
}

pub async fn load_jobs(path: impl AsRef<Path>) -> Result<HashMap<JobId, Job>> {
    let path = path.as_ref();
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let bytes = tokio::fs::read(path).await?;
    let map = serde_json::from_slice(&bytes)?;
    Ok(map)
}
