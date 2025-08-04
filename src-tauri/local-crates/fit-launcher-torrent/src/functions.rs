use anyhow::Context;
use aria2_ws::Client;
use parking_lot::RwLock;
use std::{
    env::current_exe,
    ffi::OsStr,
    fs::{File, OpenOptions},
    io::{BufReader, BufWriter},
    net::TcpListener,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Arc,
    time::Duration,
};

use tokio::{
    sync::{
        oneshot::{Receiver, Sender, channel},
    },
    time::sleep,
};

use tracing::{error, info, warn};

use crate::{FitLauncherConfigV2, config::FitLauncherConfigAria2, errors::TorrentApiError};

type AriaDaemonType = Arc<tokio::sync::Mutex<Option<(Sender<()>, Receiver<()>, u16)>>>;

lazy_static::lazy_static! {
    pub static ref ARIA2_DAEMON: AriaDaemonType =
        Arc::new(tokio::sync::Mutex::new(None));
}

struct StateShared {
    config: FitLauncherConfigV2,
    aria2_client: Option<Client>,
}

pub struct TorrentSession {
    pub config_filename: String,
    shared: Arc<RwLock<Option<StateShared>>>,
    init_lock: Arc<tokio::sync::Mutex<()>>,
}

unsafe impl Send for TorrentSession {}
unsafe impl Sync for TorrentSession {}

async fn find_port_in_range(start: u16, count: u16, exclude: Option<u16>) -> Option<u16> {
    let mut port = start;
    let mut attempts = 0;

    while attempts < count {
        if let Some(excluded) = exclude {
            if port == excluded {
                port = port.wrapping_add(1);
                continue;
            }
        }

        if is_port_available(port) {
            return Some(port);
        }

        port = port.wrapping_add(1);
        attempts += 1;
    }

    None
}

fn read_config(path: &str) -> anyhow::Result<FitLauncherConfigV2> {
    let rdr = BufReader::new(File::open(path)?);
    let cfg: FitLauncherConfigV2 = serde_json::from_reader(rdr)?;
    Ok(cfg)
}

fn write_config(path: &str, config: &FitLauncherConfigV2) -> anyhow::Result<()> {
    let parent_dir = Path::new(path).parent().context("no parent")?;
    if !parent_dir.exists() {
        std::fs::create_dir_all(parent_dir).context("failed to create config directory")?;
    }
    let tmp = format!("{path}.tmp");
    let mut tmp_file = BufWriter::new(
        OpenOptions::new()
            .write(true)
            .truncate(true)
            .create(true)
            .open(&tmp)?,
    );
    serde_json::to_writer(&mut tmp_file, config)?;
    std::fs::rename(tmp, path)?;
    Ok(())
}

pub async fn kill_existing_aria2c() -> anyhow::Result<()> {
    info!("Attempting to kill existing aria2c processes...");

    #[cfg(windows)]
    {
        let graceful_status = Command::new("taskkill")
            .args(["/IM", "aria2c.exe", "/T"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();

        if let Ok(status) = graceful_status {
            if status.success() {
                info!("Successfully terminated aria2c.exe processes gracefully");
                return Ok(());
            }
        }
        warn!("Graceful termination failed, trying forceful method");

        let force_status = Command::new("taskkill")
            .args(["/IM", "aria2c.exe", "/F", "/T"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();

        match force_status {
            Ok(status) if status.success() => {
                info!("Successfully force-killed aria2c.exe processes");
                Ok(())
            }
            Ok(status) => {
                if status.code() == Some(128) {
                    info!("No aria2c.exe processes were running");
                    Ok(())
                } else {
                    warn!(
                        "Failed to kill aria2c.exe processes with status: {:?}",
                        status.code()
                    );
                    Err(anyhow::anyhow!(
                        "Failed to kill processes with status {}",
                        status
                    ))
                }
            }
            Err(e) => {
                warn!("Failed to execute taskkill: {}", e);
                Err(anyhow::anyhow!("Failed to execute taskkill: {}", e))
            }
        }
    }

    #[cfg(not(windows))]
    {
        let status = Command::new("killall")
            .arg("aria2c")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();

        match status {
            Ok(status) if status.success() => {
                info!("Successfully killed aria2c processes");
                Ok(())
            }
            Ok(status) => {
                if status.code() == Some(1) { // killall returns 1 if no process is found
                    info!("No aria2c processes were running");
                    Ok(())
                } else {
                    warn!("Failed to kill aria2c processes with status: {:?}", status.code());
                    Err(anyhow::anyhow!("killall command failed with status {}", status))
                }
            }
            Err(e) => {
                warn!("Failed to execute killall: {}", e);
                Err(anyhow::anyhow!("Failed to execute killall: {}", e))
            }
        }
    }
}

fn build_aria2_args(
    cfg: &FitLauncherConfigV2,
    session_path: &Path,
    rpc_port: u16,
    bt_port: u16,
) -> Vec<String> {
    let mut a = Vec::<String>::new();

    // RPC ------------------------------------------------------------------
    a.push("--enable-rpc".into());
    a.push(format!("--rpc-listen-port={rpc_port}"));
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
    a.push(format!("--listen-port={bt_port}"));
    a.push(format!("--bt-max-peers={}", cfg.bittorrent.max_peers));
    if let Some(r) = cfg.bittorrent.seed_ratio {
        a.push(format!("--seed-ratio={r}"));
    }
    if let Some(t) = cfg.bittorrent.seed_time {
        a.push(format!("--seed-time={t}"));
    }
    a.push("--bt-remove-unselected-file=true".into());
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
    let mut guard = ARIA2_DAEMON.lock().await;

    // check if we have an existing daemon and try to connect
    if let Some((_, _, daemon_port)) = guard.as_ref() {
        match aria2_ws::Client::connect(
            &format!("ws://127.0.0.1:{daemon_port}/jsonrpc"),
            token.as_deref(),
        )
        .await
        {
            Ok(client) => return Ok(client),
            Err(e) => {
                warn!("Existing aria2 connection failed: {}", e);
            }
        }
    }

    if *start_daemon {
        kill_existing_aria2c().await?;

        let exec = if cfg!(windows) {
            current_exe().unwrap().parent().unwrap().join("aria2c.exe")
        } else {
            PathBuf::from("/usr/bin/aria2c")
        };

        let rpc_port = find_port_in_range(*port, 5, None).await.ok_or_else(|| {
            anyhow::anyhow!(
                "Could not find available port in range {}-{}",
                *port,
                *port + 4
            )
        })?;

        let bt_port = find_port_in_range(config.bittorrent.listen_port, 5, Some(rpc_port))
            .await
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Could not find available BitTorrent port in range {}-{}",
                    config.bittorrent.listen_port,
                    config.bittorrent.listen_port + 4
                )
            })?;

        if !is_port_available(rpc_port) {
            return Err(anyhow::anyhow!(
                "Port {} is already in use. Please choose a different port.",
                port
            ));
        }

        let mut child = Command::new(&exec)
            .args(build_aria2_args(
                config,
                Path::new(&session_path.as_ref()),
                rpc_port,
                bt_port,
            ))
            .current_dir(download_location)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to start aria2c")?;

        sleep(Duration::from_secs(1)).await;

        let client = aria2_ws::Client::connect(
            &format!("ws://127.0.0.1:{rpc_port}/jsonrpc"),
            token.as_deref(),
        )
        .await
        .context("Failed to connect to aria2c")?;

        let (close_tx, close_rx) = channel::<()>();
        let (done_tx, done_rx) = channel::<()>();

        let client_clone = client.clone();
        tokio::task::spawn(async move {
            match close_rx.await {
                Ok(()) => {
                    if let Err(e) = client_clone.force_shutdown().await {
                        warn!("Failed to shutdown aria2: {}", e);
                    }
                    if let Err(e) = child.wait() {
                        warn!("Failed to wait for aria2c: {}", e);
                    }
                    let _ = done_tx.send(());
                }
                Err(_) => warn!("Shutdown signal dropped"),
            }
        });

        *guard = Some((close_tx, done_rx, rpc_port));
        Ok(client)
    } else {
        let rpc_port = find_port_in_range(*port, 5, None).await.ok_or_else(|| {
            anyhow::anyhow!(
                "Could not find available port in range {}-{}",
                *port,
                *port + 4
            )
        })?;
        aria2_ws::Client::connect(
            &format!("ws://127.0.0.1:{rpc_port}/jsonrpc"),
            token.as_deref(),
        )
        .await
        .context("Could not connect to already running aria2 RPC server")
    }
}

fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

impl TorrentSession {
    pub async fn init_client(&self) -> anyhow::Result<()> {
        info!("Starting initialization of client");
        let config_dir = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_dir()
            .join("com.fitlauncher.carrotrub");

        let aria2_session = config_dir.join("aria2.session");

        let config_filename = config_dir
            .join("torrentConfig")
            .join("config.json")
            .to_string_lossy()
            .to_string();

        if !Path::new(&config_filename).exists() {
            if let Err(e) = write_config(&config_filename, &FitLauncherConfigV2::default()) {
                error!("Error writing default config: {}", e);
            }
        }

        let final_config = match read_config(&config_filename) {
            Ok(cfg) => cfg,
            Err(e) => {
                return Err(anyhow::anyhow!("Failed to read config: {}", e));
            }
        };

        let aria2_client = match aria2_client_from_config(&final_config, aria2_session).await {
            Ok(c) => {
                info!("Connected to aria2c successfully");
                Some(c)
            }
            Err(e) => {
                error!("Failed to connect to aria2: {:#}", e);
                None
            }
        };

        let mut shared_guard = self.shared.write();
        if let Some(shared) = shared_guard.as_mut() {
            shared.aria2_client = aria2_client;
        } else {
            *shared_guard = Some(StateShared {
                config: final_config,
                aria2_client,
            });
        }
        info!("Initialization of client done");
        Ok(())
    }

    pub async fn new() -> Self {
        warn!("Starting Initialization");
        let config_dir = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_dir() // Points to AppData\Roaming (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub");

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

            let aria2_client = None;

            let shared = Arc::new(RwLock::new(Some(StateShared {
                config,
                aria2_client,
            })));

            return Self {
                config_filename,
                shared,
                init_lock: Arc::new(tokio::sync::Mutex::new(())),
            };
        }

        Self {
            config_filename,
            shared: Arc::new(RwLock::new(None)),
            init_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }

    pub async fn aria2_client(&self) -> anyhow::Result<aria2_ws::Client> {
        let _guard = self.init_lock.lock().await;

        {
            let g = self.shared.read();
            if let Some(shared) = g.as_ref() {
                if let Some(client) = &shared.aria2_client {
                    return Ok(client.clone());
                }
            }
        }

        warn!("Aria2 client not configured, attempting initialization...");
        self.init_client().await?;

        let g = self.shared.read();
        if let Some(shared) = g.as_ref() {
            if let Some(client) = &shared.aria2_client {
                return Ok(client.clone());
            }
        }

        Err(anyhow::anyhow!("Failed to initialize aria2 client"))
    }

    pub async fn configure(&self, config: FitLauncherConfigV2) -> Result<(), TorrentApiError> {
        if let Err(e) = write_config(&self.config_filename, &config) {
            error!("error writing config: {:#}", e);
        }

        let mut g = self.shared.write();
        *g = Some(StateShared {
            config,
            aria2_client: None,
        });
        Ok(())
    }

    pub async fn get_config(&self) -> FitLauncherConfigV2 {
        let g = self.shared.read();
        if let Some(shared) = g.as_ref() {
            shared.config.clone()
        } else {
            error!(
                "Tried to somehow get config before any initialization, has returned default config"
            );
            FitLauncherConfigV2::default()
        }
    }

    pub async fn shutdown(&self) {
        let handles = {
            let mut guard = ARIA2_DAEMON.lock().await;
            guard.take()
        };

        if let Some((close_tx, done_rx, _port)) = handles {
            let _ = close_tx.send(());
            let _ = done_rx.await;
        }
    }
}
