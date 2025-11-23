use crate::{
    manager::DownloadManager,
    types::{DownloadState, FileStatus},
};
use aria2_ws::Client;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::time::{Duration, sleep};
use tracing::{error, info};

fn normalize(statuses: &[aria2_ws::response::Status]) -> Vec<FileStatus> {
    statuses
        .iter()
        .map(|s| FileStatus {
            gid: Some(s.gid.clone()),
            status: s.status.clone().into(),
            total_length: s.total_length,
            completed_length: s.completed_length,
            download_speed: s.download_speed,
            upload_speed: s.upload_speed,
            files: s.files.clone(),
            info_hash: s.info_hash.clone(),
        })
        .collect()
}

/// Polls aria2 every 500ms and feeds (yum yum yum) updates to DownloadManager
pub fn spawn_dispatcher(manager: Arc<DownloadManager>, client: Arc<tokio::sync::Mutex<Client>>) {
    tokio::spawn(async move {
        info!("Dispatcher: starting aria2 poll loop");
        let mut last_hash = String::new();

        loop {
            let statuses = {
                let locked = client.lock().await;
                match locked.tell_active().await {
                    Ok(mut active) => {
                        if let Ok(mut waiting) = locked.tell_waiting(0, 100).await {
                            active.append(&mut waiting);
                        }
                        if let Ok(mut stopped) = locked.tell_stopped(0, 100).await {
                            active.append(&mut stopped);
                        }
                        active
                    }
                    Err(err) => {
                        error!("Error fetching aria2 tasks: {:?}", err);
                        Vec::new()
                    }
                }
            };
            let normalized = normalize(&statuses);

            if let Ok(serialized) = serde_json::to_string(&normalized) {
                let hash = format!("{:x}", Sha256::digest(serialized.as_bytes()));
                if hash != last_hash {
                    last_hash = hash;
                    manager.on_aria2_update(statuses).await;
                }
            }

            sleep(Duration::from_millis(500)).await;
        }
    });
}
