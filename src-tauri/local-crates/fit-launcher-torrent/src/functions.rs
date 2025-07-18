use anyhow::Context;
use aria2_ws::Client;
use parking_lot::{Mutex, RwLock};
use std::{
    env::current_exe,
    ffi::OsStr,
    fs::{File, OpenOptions},
    io::{BufReader, BufWriter},
    net::TcpListener,
    path::{Path, PathBuf},
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

type AriaDaemonType = Arc<Mutex<Option<(Sender<()>, Receiver<()>)>>>;
lazy_static::lazy_static! {
    pub static ref ARIA2_DAEMON: AriaDaemonType =
        Arc::new(Mutex::new(None));
}

struct StateShared {
    config: FitLauncherConfigV2,
    aria2_client: Option<Client>,
}

pub struct TorrentSession {
    pub config_filename: String,
    shared: Arc<RwLock<Option<StateShared>>>,
}

unsafe impl Send for TorrentSession {}
unsafe impl Sync for TorrentSession {}

fn read_config(path: &str) -> anyhow::Result<FitLauncherConfigV2> {
    let rdr = BufReader::new(File::open(path)?);
    let cfg: FitLauncherConfigV2 = serde_json::from_reader(rdr)?;
    Ok(cfg)
}

fn write_config(path: &str, config: &FitLauncherConfigV2) -> anyhow::Result<()> {
    std::fs::create_dir_all(Path::new(path).parent().context("no parent")?)
        .context("error creating dirs")?;
    let tmp = format!("{path}.tmp");
    let mut tmp_file = BufWriter::new(
        OpenOptions::new()
            .write(true)
            .truncate(true)
            .create(true)
            .open(&tmp)?,
    );
    serde_json::to_writer(&mut tmp_file, config)?;
    println!("{path}");
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
    let handles = {
        let mut guard = ARIA2_DAEMON.lock();
        guard.take()
    };

    if let Some((close_tx, done_rx)) = handles {
        let connect_result =
            aria2_ws::Client::connect(&format!("ws://127.0.0.1:{port}/jsonrpc"), token.as_deref())
                .await;

        match connect_result {
            Ok(client) => {
                ARIA2_DAEMON.lock().replace((close_tx, done_rx));
                return Ok(client);
            }
            Err(e) => {
                warn!(
                    "Existing aria2 connection failed, attempting to restart: {}",
                    e
                );
                if close_tx.send(()).is_ok() {
                    let _ = done_rx.await;
                    sleep(Duration::from_secs(1)).await;
                } else {
                    warn!("Failed to send shutdown signal to aria2 daemon");
                }
            }
        }
    }

    if *start_daemon {
        let exec = if cfg!(debug_assertions) {
            if cfg!(windows) {
                PathBuf::from("../../binaries/aria2c-x86_64-pc-windows-msvc")
            } else {
                PathBuf::from("aria2c")
            }
        } else if cfg!(windows) {
            current_exe().unwrap().parent().unwrap().join("aria2c.exe")
        } else {
            PathBuf::from("aria2c")
        };

        let mut current_port = *port;
        let mut max_retries = 10;
        let client = loop {
            let mut child = match Command::new(&exec)
                .args(build_aria2_args(config, Path::new(&session_path.as_ref())))
                .current_dir(download_location)
                .spawn()
            {
                Ok(child) => child,
                Err(e) => {
                    if max_retries == 0 {
                        return Err(e).context("Failed to start aria2c after multiple attempts");
                    }
                    max_retries -= 1;
                    current_port = find_available_port(current_port).await;
                    warn!(
                        "Failed to start aria2c on port {}, trying {}: {}",
                        port, current_port, e
                    );
                    continue;
                }
            };

            match aria2_ws::Client::connect(
                &format!("ws://127.0.0.1:{current_port}/jsonrpc"),
                token.as_deref(),
            )
            .await
            {
                Ok(client) => break client,
                Err(e) => {
                    if max_retries == 0 {
                        let _ = child.kill();
                        return Err(e)
                            .context("Failed to connect to aria2c after multiple attempts");
                    }
                    max_retries -= 1;

                    if let Err(kill_err) = child.kill() {
                        warn!("Failed to kill aria2c process: {}", kill_err);
                    }

                    current_port = find_available_port(current_port).await;
                    warn!(
                        "Failed to connect to aria2c on port {}, trying {}: {}",
                        port, current_port, e
                    );

                    sleep(Duration::from_millis(500)).await;
                    continue;
                }
            }
        };

        let (close_tx, close_rx) = channel::<()>();
        let (done_tx, done_rx) = channel::<()>();

        let client_clone = client.clone();
        tokio::task::spawn(async move {
            match close_rx.await {
                Ok(()) => {
                    if let Err(e) = client_clone.force_shutdown().await {
                        warn!("Failed to shutdown aria2 gracefully: {}", e);
                    }

                    let _ = done_tx.send(());
                }
                Err(_) => {
                    warn!("Shutdown signal dropped before reaching aria2 task");
                }
            }
        });

        ARIA2_DAEMON.lock().replace((close_tx, done_rx));
        return Ok(client);
    }

    aria2_ws::Client::connect(&format!("ws://127.0.0.1:{port}/jsonrpc"), token.as_deref())
        .await
        .context("Could not connect to already running aria2 RPC server")
}

async fn find_available_port(start_port: u16) -> u16 {
    let mut port = start_port + 1;
    for _ in 0..100 {
        if is_port_available(port) {
            return port;
        }
        port = port.wrapping_add(1);
    }

    port = 49152 + (rand::random::<u16>() % 16384);
    port
}

fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

impl TorrentSession {
    pub async fn init_client(&self) -> anyhow::Result<()> {
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
            match write_config(&config_filename, &FitLauncherConfigV2::default()) {
                Ok(_) => info!(
                    "Default config written successfully to: {}",
                    &config_filename
                ),
                Err(e) => error!("Error writing default config: {}", e),
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
                println!("Client Found");
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
            };
        }

        Self {
            config_filename,
            shared: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn aria2_client(&self) -> anyhow::Result<aria2_ws::Client> {
        {
            let g = self.shared.read();
            if let Some(shared) = g.as_ref() {
                if let Some(client) = &shared.aria2_client {
                    return Ok(client.clone());
                }
            }
        }

        warn!("Aria2 client not configured, attempting initialization...");

        let config = self.get_config().await;
        let config_dir = directories::BaseDirs::new()
            .context("Could not determine base directories")?
            .config_dir()
            .join("com.fitlauncher.carrotrub");

        let aria2_session = config_dir.join("aria2.session");
        let client = aria2_client_from_config(&config, aria2_session).await?;

        {
            let mut g = self.shared.write();
            if let Some(shared) = g.as_mut() {
                shared.aria2_client = Some(client.clone());
            } else {
                return Err(anyhow::anyhow!("Shared state not initialized"));
            }
        }

        Ok(client)
    }

    pub async fn configure(&self, config: FitLauncherConfigV2) -> Result<(), TorrentApiError> {
        if let Err(e) = write_config(&self.config_filename, &config) {
            error!("error writing config: {:#}", e);
        }

        let mut g = self.shared.write();
        *g = Some(StateShared {
            config,
            aria2_client: None, // Client will be initialized separately from now on, no more new on config
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
            let mut guard = ARIA2_DAEMON.lock();
            guard.take()
        };

        if let Some((close_tx, done_rx)) = handles {
            let _ = close_tx.send(());
            let _ = done_rx.await;
        }
    }
}
