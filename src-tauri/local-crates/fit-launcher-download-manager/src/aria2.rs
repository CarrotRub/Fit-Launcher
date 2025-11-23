use std::{sync::Arc, time::Duration};

use anyhow::Result;
use aria2_ws::{Client, response::Status};
use fit_launcher_aria2::{
    aria2::{aria2_add_torrent, aria2_add_uri},
    error::Aria2Error,
};
use fit_launcher_torrent::FitLauncherConfigAria2;
use sha2::Digest;
use tokio::sync::Mutex;
use tracing::error;

use crate::manager::DownloadManager;

#[derive(Clone)]
pub struct Aria2WsClient {
    pub client: Arc<Mutex<Client>>,
}

impl Aria2WsClient {
    pub fn new(client: Arc<Mutex<Client>>) -> Self {
        Self { client }
    }

    pub async fn add_uri(
        &self,
        url: Vec<String>,
        dir: Option<String>,
        filename: Option<String>,
        cfg: FitLauncherConfigAria2,
    ) -> Result<String, Aria2Error> {
        let guard = self.client.lock().await;

        aria2_add_uri(&guard, url, dir, filename, cfg).await
    }

    pub async fn add_torrent(
        &self,
        torrent: Vec<u8>,
        dir: Option<String>,
        selected: Vec<usize>,
    ) -> Result<String, Aria2Error> {
        let guard = self.client.lock().await;
        aria2_add_torrent(&guard, torrent, dir, selected).await
    }

    pub async fn pause(&self, gid: &str) -> Result<(), Aria2Error> {
        let guard = self.client.lock().await;
        guard.pause(gid).await?;
        Ok(())
    }

    pub async fn resume(&self, gid: &str) -> Result<(), Aria2Error> {
        let guard = self.client.lock().await;
        guard.unpause(gid).await?;
        Ok(())
    }

    pub async fn remove(&self, gid: &str) -> Result<(), Aria2Error> {
        let guard = self.client.lock().await;
        guard.remove(gid).await?;
        Ok(())
    }

    /// Fetch all (active + waiting + stopped)
    pub async fn list_all(&self) -> Result<Vec<Status>, Aria2Error> {
        let client = self.client.lock().await;

        let mut active = client.tell_active().await?;
        let mut waiting = client.tell_waiting(0, 100).await?;
        let mut stopped = client.tell_stopped(0, 100).await?;

        let mut list: Vec<Status> = Vec::new();

        list.append(&mut active);
        list.append(&mut waiting);
        list.append(&mut stopped);

        Ok(list)
    }

    /// Spawn a background polling task that feeds DownloadManager
    pub fn spawn_status_listener(self, manager: Arc<DownloadManager>) {
        tokio::spawn(async move {
            let mut last_hash = String::new();

            loop {
                let statuses_result = self.list_all().await;

                match statuses_result {
                    Ok(statuses) => {
                        if let Ok(serialized) = serde_json::to_string(&statuses) {
                            let hash = format!("{:x}", sha2::Sha256::digest(serialized.as_bytes()));
                            if hash != last_hash {
                                last_hash = hash.clone();

                                manager.on_aria2_update(statuses).await;
                            }
                        }
                    }
                    Err(err) => {
                        error!("Aria2 status poll error: {:?}", err);
                    }
                }

                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        });
    }
}
