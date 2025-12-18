use std::{sync::Arc, time::Duration};

use anyhow::Result;
use aria2_ws::{Client, response::Status};
use fit_launcher_aria2::{
    aria2::{aria2_add_torrent, aria2_add_uri},
    error::Aria2Error,
};
use fit_launcher_torrent::{FitLauncherConfigAria2, functions::TorrentSession};
use sha2::Digest;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

use crate::manager::DownloadManager;

/// Timeout for aria2 operations (health check uses a shorter timeout)
const OPERATION_TIMEOUT: Duration = Duration::from_secs(15);
const HEALTH_CHECK_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Clone)]
pub struct Aria2WsClient {
    pub client: Arc<Mutex<Client>>,
    /// Reference to TorrentSession for reconnection capability
    session: Arc<TorrentSession>,
}

impl Aria2WsClient {
    pub fn new(client: Arc<Mutex<Client>>, session: Arc<TorrentSession>) -> Self {
        Self { client, session }
    }

    /// Check if the connection is healthy by doing a quick version call
    async fn is_healthy(&self) -> bool {
        let client = self.client.lock().await;
        match tokio::time::timeout(HEALTH_CHECK_TIMEOUT, client.get_version()).await {
            Ok(Ok(_)) => true,
            Ok(Err(e)) => {
                warn!("Aria2 health check failed: {}", e);
                false
            }
            Err(_) => {
                warn!("Aria2 health check timed out");
                false
            }
        }
    }

    /// Ensure connection is healthy, reconnecting if necessary
    async fn ensure_connected(&self) -> Result<(), Aria2Error> {
        if self.is_healthy().await {
            return Ok(());
        }

        info!("Aria2 connection is stale, attempting reconnection...");

        // Reinitialize the aria2 client through TorrentSession
        self.session
            .init_client()
            .await
            .map_err(|e| Aria2Error::InitializationFailed(e.to_string()))?;

        // Get the new client and update our reference
        let new_client = self
            .session
            .aria2_client()
            .await
            .map_err(|e| Aria2Error::InitializationFailed(e.to_string()))?;

        *self.client.lock().await = new_client;

        info!("Aria2 reconnection successful");
        Ok(())
    }

    pub async fn add_uri(
        &self,
        url: Vec<String>,
        dir: Option<String>,
        filename: Option<String>,
        cfg: FitLauncherConfigAria2,
    ) -> Result<String, Aria2Error> {
        // Ensure connection is healthy before critical operation
        self.ensure_connected().await?;

        let guard = self.client.lock().await;

        match tokio::time::timeout(
            OPERATION_TIMEOUT,
            aria2_add_uri(&guard, url, dir, filename, cfg),
        )
        .await
        {
            Ok(result) => result,
            Err(_) => Err(Aria2Error::Timeout("add_uri operation timed out".into())),
        }
    }

    pub async fn add_torrent(
        &self,
        torrent: Vec<u8>,
        dir: Option<String>,
        selected: Vec<usize>,
    ) -> Result<String, Aria2Error> {
        // Ensure connection is healthy before critical operation
        self.ensure_connected().await?;

        let guard = self.client.lock().await;

        match tokio::time::timeout(
            OPERATION_TIMEOUT,
            aria2_add_torrent(&guard, torrent, dir, selected),
        )
        .await
        {
            Ok(result) => result,
            Err(_) => Err(Aria2Error::Timeout(
                "add_torrent operation timed out".into(),
            )),
        }
    }

    pub async fn pause(&self, gid: &str) -> Result<(), Aria2Error> {
        let guard = self.client.lock().await;

        match tokio::time::timeout(OPERATION_TIMEOUT, guard.pause(gid)).await {
            Ok(result) => {
                result?;
                Ok(())
            }
            Err(_) => Err(Aria2Error::Timeout("pause operation timed out".into())),
        }
    }

    pub async fn resume(&self, gid: &str) -> Result<(), Aria2Error> {
        let guard = self.client.lock().await;

        match tokio::time::timeout(OPERATION_TIMEOUT, guard.unpause(gid)).await {
            Ok(result) => {
                result?;
                Ok(())
            }
            Err(_) => Err(Aria2Error::Timeout("resume operation timed out".into())),
        }
    }

    pub async fn remove(&self, gid: &str) -> Result<(), Aria2Error> {
        let guard = self.client.lock().await;

        match tokio::time::timeout(OPERATION_TIMEOUT, guard.remove(gid)).await {
            Ok(result) => {
                result?;
                Ok(())
            }
            Err(_) => Err(Aria2Error::Timeout("remove operation timed out".into())),
        }
    }

    /// Fetch all (active + waiting + stopped)
    pub async fn list_all(&self) -> Result<Vec<Status>, Aria2Error> {
        let client = self.client.lock().await;

        // Use timeout for list operations too
        let active = match tokio::time::timeout(OPERATION_TIMEOUT, client.tell_active()).await {
            Ok(result) => result?,
            Err(_) => return Err(Aria2Error::Timeout("tell_active timed out".into())),
        };

        let waiting =
            match tokio::time::timeout(OPERATION_TIMEOUT, client.tell_waiting(0, 100)).await {
                Ok(result) => result?,
                Err(_) => return Err(Aria2Error::Timeout("tell_waiting timed out".into())),
            };

        let stopped =
            match tokio::time::timeout(OPERATION_TIMEOUT, client.tell_stopped(0, 100)).await {
                Ok(result) => result?,
                Err(_) => return Err(Aria2Error::Timeout("tell_stopped timed out".into())),
            };

        let mut list: Vec<Status> = Vec::new();
        list.extend(active);
        list.extend(waiting);
        list.extend(stopped);

        Ok(list)
    }

    /// Spawn a background polling task that feeds DownloadManager
    pub fn spawn_status_listener(self, manager: Arc<DownloadManager>) {
        tokio::spawn(async move {
            let mut last_hash = String::new();
            let mut consecutive_errors = 0u32;

            loop {
                let statuses_result = self.list_all().await;

                match statuses_result {
                    Ok(statuses) => {
                        consecutive_errors = 0;
                        if let Ok(serialized) = serde_json::to_string(&statuses) {
                            let hash = format!("{:x}", sha2::Sha256::digest(serialized.as_bytes()));
                            if hash != last_hash {
                                last_hash = hash.clone();

                                manager.on_aria2_update(statuses).await;
                            }
                        }
                    }
                    Err(err) => {
                        consecutive_errors += 1;
                        error!(
                            "Aria2 status poll error (consecutive: {}): {:?}",
                            consecutive_errors, err
                        );

                        // If we have multiple consecutive errors, try to reconnect
                        if consecutive_errors >= 3 {
                            warn!(
                                "Multiple consecutive aria2 poll errors, attempting reconnection..."
                            );
                            if let Err(e) = self.ensure_connected().await {
                                error!("Failed to reconnect aria2: {:?}", e);
                            } else {
                                consecutive_errors = 0;
                            }
                        }
                    }
                }

                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        });
    }
}
