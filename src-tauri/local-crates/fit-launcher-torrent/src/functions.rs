use anyhow::Context;
use aria2_ws::Client;
use once_cell::sync::Lazy;
use parking_lot::{Mutex, RwLock};
use std::{
    ffi::OsStr,
    fs::{File, OpenOptions},
    io::{BufReader, BufWriter},
    path::Path,
    process::Command,
    sync::Arc,
    time::Duration,
};

use tokio::{
    sync::oneshot::{Receiver, Sender, channel},
    time::sleep,
};

use tracing::{error, info, warn};

use crate::{FitLauncherConfigV2, config::FitLauncherConfigAria2, errors::TorrentApiError};

type AriaDaemonType = Lazy<Mutex<Option<(Sender<()>, Receiver<()>)>>>;

pub static ARIA2_DAEMON: AriaDaemonType = Lazy::new(|| Mutex::new(None));

struct StateShared {
    config: FitLauncherConfigV2,
    aria2_client: Option<Client>,
}

pub struct TorrentSession {
    pub config_filename: String,
    shared: Arc<RwLock<Option<StateShared>>>,
}

fn read_config(path: &str) -> anyhow::Result<FitLauncherConfigV2> {
    let rdr = BufReader::new(File::open(path)?);
    let cfg: FitLauncherConfigV2 = serde_json::from_reader(rdr)?;
    Ok(cfg)
}

fn write_config(path: &str, config: &FitLauncherConfigV2) -> anyhow::Result<()> {
    std::fs::create_dir_all(Path::new(path).parent().context("no parent")?)
        .context("error creating dirs")?;
    let tmp = format!("{}.tmp", path);
    let mut tmp_file = BufWriter::new(
        OpenOptions::new()
            .write(true)
            .truncate(true)
            .create(true)
            .open(&tmp)?,
    );
    serde_json::to_writer(&mut tmp_file, config)?;
    println!("{}", path);
    std::fs::rename(tmp, path)?;
    Ok(())
}

fn build_aria2_args(cfg: &FitLauncherConfigV2, session_path: &Path) -> Vec<String> {
    let mut a = Vec::<String>::new();

    // RPC ------------------------------------------------------------------
    a.push("--enable-rpc".into());
    a.push(format!("--rpc-listen-port={}", cfg.rpc.port));
    if let Some(tok) = &cfg.rpc.token {
        a.push(format!("--rpc-secret={tok}"));
    }

    // General --------------------------------------------------------------
    a.push(format!("--dir={}", cfg.general.download_dir.display()));
    a.push(format!(
        "--max-concurrent-downloads={}",
        cfg.general.concurrent_downloads
    ));

    // Transfer limits ------------------------------------------------------
    if let Some(v) = cfg.limits.max_overall_download {
        a.push(format!("--max-overall-download-limit={v}"));
    }
    if let Some(v) = cfg.limits.max_overall_upload {
        a.push(format!("--max-overall-upload-limit={v}"));
    }
    if let Some(v) = cfg.limits.max_download {
        a.push(format!("--max-download-limit={v}"));
    }
    if let Some(v) = cfg.limits.max_upload {
        a.push(format!("--max-upload-limit={v}"));
    }

    // Network --------------------------------------------------------------
    a.push(format!(
        "--max-connection-per-server={}",
        cfg.network.max_connection_per_server
    ));
    a.push(format!("--split={}", cfg.network.split));
    a.push(format!("--min-split-size={}", cfg.network.min_split_size));
    a.push(format!(
        "--connect-timeout={}",
        cfg.network.connect_timeout.as_secs()
    ));
    a.push(format!("--timeout={}", cfg.network.rw_timeout.as_secs()));

    // BitTorrent -----------------------------------------------------------
    if !cfg.bittorrent.enable_dht {
        a.push("--enable-dht=false".into());
    }
    a.push(format!("--listen-port={}", cfg.bittorrent.listen_port));
    a.push(format!("--bt-max-peers={}", cfg.bittorrent.max_peers));
    if let Some(r) = cfg.bittorrent.seed_ratio {
        a.push(format!("--seed-ratio={r}"));
    }
    if let Some(t) = cfg.bittorrent.seed_time {
        a.push(format!("--seed-time={t}"));
    }

    // Session persistence --------------------------------------------------
    a.push("--save-session".into());
    a.push(session_path.display().to_string());

    a
}

pub async fn aria2_client_from_config(
    config: &FitLauncherConfigV2,
    session_path: impl AsRef<OsStr>,
) -> anyhow::Result<aria2_ws::Client> {
    let FitLauncherConfigAria2 {
        port,
        token,
        start_daemon,
    } = &config.rpc;

    let download_location = &config.general.download_dir;

    if *start_daemon && ARIA2_DAEMON.lock().is_none() {
        #[cfg(not(debug_assertions))]
        let exec = if cfg!(windows) { "./aria2c" } else { "aria2c" };
        #[cfg(not(debug_assertions))]
        let mut child = Command::new(exec)
            .args(build_aria2_args(config, Path::new(&session_path.as_ref())))
            .current_dir(&config.general.download_dir)
            .spawn()?;

        #[cfg(debug_assertions)]
        let mut child = Command::new(if cfg!(windows) {
            "../../binaries/aria2c-x86_64-pc-windows-msvc"
        } else {
            "aria2c"
        })
        .arg("--enable-rpc")
        .arg(format!("--rpc-listen-port={port}"))
        .arg("--max-connection-per-server=5")
        .arg("--save-session")
        .arg(session_path.as_ref())
        .current_dir(download_location)
        .spawn()?;

        let client = 'retry: {
            let mut last_err = None;
            for _ in 0..10 {
                match aria2_ws::Client::connect(
                    &format!("ws://127.0.0.1:{port}/jsonrpc"),
                    token.as_deref(),
                )
                .await
                {
                    Ok(client) => break 'retry Ok(client),
                    Err(e) => {
                        last_err = Some(e);
                        sleep(Duration::from_millis(300)).await;
                    }
                }
            }
            Err(anyhow::anyhow!(
                "aria2c failed to start after retries: {:?}",
                last_err
            ))
        }?;

        let (close_tx, close_rx) = channel();
        let (done_tx, done_rx) = channel();

        let client_clone = client.clone();
        tokio::task::spawn(async move {
            match close_rx.await {
                Ok(_) => {
                    let _ = client_clone.force_shutdown().await;
                    let _ = child.wait();
                    let _ = done_tx.send(());
                }
                Err(_) => {
                    error!("close_tx closed unexpectedly, fail to close aria2 gracefully");
                }
            }
        });

        let _ = ARIA2_DAEMON.lock().replace((close_tx, done_rx));
        return Ok(client);
    }

    aria2_ws::Client::connect(&format!("ws://127.0.0.1:{port}/jsonrpc"), token.as_deref())
        .await
        .context("Could not connect to already running aria2 RPC server")
}

impl TorrentSession {
    pub async fn new() -> Self {
        warn!("Starting Initialization");
        let config_dir = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_dir() // Points to AppData\Roaming (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub");

        let aria2_session = config_dir.join("aria2.session");
        let config_filename = config_dir
            .join("torrentConfig")
            .join("config.json")
            .to_string_lossy()
            .to_string();

        if !Path::new(&config_filename).exists() {
            match write_config(&config_filename, &FitLauncherConfigV2::default()) {
                Ok(_) => info!(
                    "Default config written successfully to: {}",
                    &config_filename
                ),
                Err(e) => error!("Error writing default config: {}", e),
            }
        }
        warn!("Config Path: {}", &config_filename);
        if let Ok(config) = read_config(&config_filename) {
            match write_config(&config_filename, &config) {
                Ok(_) => info!(
                    "Default config written successfully to: {}",
                    &config_filename
                ),
                Err(e) => error!("Error writing default config: {}", e),
            }

            let aria2_client = match aria2_client_from_config(&config, aria2_session).await {
                Ok(c) => {
                    println!("Client Found");
                    Some(c)
                }
                Err(e) => {
                    error!("Failed to connect to aria2: {:#}", e);
                    None
                }
            };

            let shared = Arc::new(RwLock::new(Some(StateShared {
                config,
                aria2_client,
            })));

            return Self {
                config_filename,
                shared,
            };
        }

        Self {
            config_filename,
            shared: Arc::new(RwLock::new(None)),
        }
    }

    pub fn aria2_client(&self) -> anyhow::Result<aria2_ws::Client> {
        let g = self.shared.read();
        if g.is_none() {
            warn!("Shared state is uninitialized");
        }

        g.as_ref()
            .and_then(|s| s.aria2_client.clone())
            .context("aria2 rpc server not configured")
    }

    pub async fn configure(&self, config: FitLauncherConfigV2) -> Result<(), TorrentApiError> {
        let config_dir = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_dir() // Points to AppData\Roaming (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub");
        let aria2_session = config_dir.join("aria2.session");

        let aria2_client = Some(
            aria2_client_from_config(&config, aria2_session)
                .await
                .map_err(|e| TorrentApiError::Aria2StartupError(e.to_string()))?,
        );

        if let Err(e) = write_config(&self.config_filename, &config) {
            error!("error writing config: {:#}", e);
        }

        let mut g = self.shared.write();
        *g = Some(StateShared {
            config,
            aria2_client,
        });
        Ok(())
    }

    pub async fn get_config(&self) -> FitLauncherConfigV2 {
        let g = self.shared.read();
        if let Some(shared) = g.as_ref() {
            shared.config.clone()
        } else {
            warn!(
                "Tried to somehow get config before any initialization, has returned default config"
            );
            FitLauncherConfigV2::default()
        }
    }
}
