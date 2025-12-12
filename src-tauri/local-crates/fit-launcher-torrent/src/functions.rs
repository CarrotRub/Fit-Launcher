use anyhow::Context;
use aria2_ws::Client;
use parking_lot::RwLock;
use std::{
    env::current_exe,
    ffi::OsStr,
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{Arc, LazyLock},
    time::Duration,
};

use tokio::{
    sync::{
        Mutex,
        oneshot::{Receiver, Sender, channel},
    },
    time::sleep,
};

use tracing::{error, info, warn};

use crate::{
    FileAllocation, FitLauncherConfigV2,
    config::{FitLauncherConfigAria2, load_or_migrate, write_cfg},
    errors::TorrentApiError,
};

type AriaDaemonType = Arc<tokio::sync::Mutex<Option<(Sender<()>, Receiver<()>, u16)>>>;

pub static ARIA2_DAEMON: LazyLock<AriaDaemonType> =
    LazyLock::new(|| Arc::new(tokio::sync::Mutex::new(None)));

struct StateShared {
    config: FitLauncherConfigV2,
    aria2_client: Option<Client>,
}

pub struct TorrentSession {
    pub config_filename: String,
    shared: Arc<RwLock<Option<StateShared>>>,
    init_lock: Arc<tokio::sync::Mutex<()>>,
    aria2_child: Arc<tokio::sync::Mutex<Option<tokio::process::Child>>>,
}

unsafe impl Send for TorrentSession {}
unsafe impl Sync for TorrentSession {}

async fn find_port_in_range(start: u16, count: u16, exclude: Option<u16>) -> Option<u16> {
    let mut port = start;
    let mut attempts = 0;

    while attempts < count {
        if let Some(excluded) = exclude
            && port == excluded
        {
            port = port.wrapping_add(1);
            continue;
        }

        if is_port_available(port) {
            return Some(port);
        }

        port = port.wrapping_add(1);
        attempts += 1;
    }

    None
}

fn build_aria2_args(
    cfg: &FitLauncherConfigV2,
    session_path: &Path,
    rpc_port: u16,
    bt_port: u16,
) -> Vec<String> {
    let mut a = Vec::<String>::new();

    // Disable file renaming, i.e. always skip existing files
    a.push("--auto-file-renaming=false".into());

    // RPC ------------------------------------------------------------------
    a.push("--enable-rpc".into());
    let rpc_port = rpc_port.clamp(1024, 65535);
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
    let connect_timeout = cfg.network.connect_timeout.as_secs().clamp(1, 600);
    a.push(format!("--connect-timeout={}", connect_timeout));
    let rw_timeout = cfg.network.rw_timeout.as_secs().clamp(1, 600);
    a.push(format!("--timeout={}", rw_timeout));

    // BitTorrent -----------------------------------------------------------
    if !cfg.bittorrent.enable_dht {
        a.push("--enable-dht=false".into());
    }
    let bt_listen = bt_port.clamp(1024, 65535);
    a.push(format!("--listen-port={bt_listen}"));
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

    match cfg.rpc.file_allocation {
        FileAllocation::Auto => {
            if !cfg!(windows) {
                a.push("--file-allocation=falloc".into());
            }
        }
        FileAllocation::Falloc => a.push("--file-allocation=falloc".into()),
        FileAllocation::Prealloc => a.push("--file-allocation=prealloc".into()),
        FileAllocation::None => a.push("--file-allocation=none".into()),
    }

    a
}

pub async fn aria2_client_from_config(
    config: &FitLauncherConfigV2,
    session_path: impl AsRef<OsStr>,
    v2_path: impl AsRef<Path>,
) -> anyhow::Result<aria2_ws::Client> {
    let FitLauncherConfigAria2 {
        port,
        token,
        start_daemon,
        ..
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
        let exec = if cfg!(windows) {
            current_exe().unwrap().parent().unwrap().join("aria2c.exe")
        } else {
            PathBuf::from("aria2c")
        };

        let rpc_port = find_port_in_range(*port, 10, None).await.ok_or_else(|| {
            anyhow::anyhow!(
                "Could not find available port in range {}-{}",
                *port,
                *port + 4
            )
        })?;
        if &rpc_port != port {
            let mut new_cfg = config.clone();
            new_cfg.rpc.port = rpc_port;
            write_cfg(v2_path, &new_cfg)?;
        }

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
        let mut child = {
            #[cfg(windows)]
            {
                use std::ffi::OsString;

                use crate::hooks::windows::spawn_with_job_object;

                spawn_with_job_object(
                    exec.as_os_str(),
                    &build_aria2_args(config, Path::new(&session_path.as_ref()), rpc_port, bt_port)
                        .into_iter()
                        .map(|s| s.into())
                        .collect::<Vec<OsString>>(),
                    Some(&download_location),
                )
                .context("Failed to start aria2c")?
            }

            #[cfg(not(windows))]
            {
                use std::process::Stdio;

                tokio::process::Command::new(&exec)
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
                    .context("Failed to start aria2c")?
            }
        };

        sleep(Duration::from_secs(1)).await;

        let client = aria2_ws::Client::connect(
            &format!("ws://127.0.0.1:{rpc_port}/jsonrpc"),
            token.as_deref(),
        )
        .await
        .context("Failed to connect to aria2c")?;

        info!("Successfully connected to newly created aria2c instance on port: {rpc_port}");

        let (close_tx, close_rx) = channel::<()>();
        let (done_tx, done_rx) = channel::<()>();

        let client_clone = client.clone();

        tokio::spawn(async move {
            match close_rx.await {
                Ok(()) => {
                    let _ = client_clone.force_shutdown().await;
                    let _ = child.kill().await;
                    let _ = done_tx.send(());
                }
                Err(_) => warn!("Shutdown signal dropped"),
            }
        });

        *guard = Some((close_tx, done_rx, rpc_port));
        Ok(client)
    } else {
        // when we don't start `aria2` ourself,
        // try to connect to the existing instance with configured port
        match aria2_ws::Client::connect(&format!("ws://127.0.0.1:{port}/jsonrpc"), token.as_deref())
            .await
            .context("Could not connect to already running aria2c RPC server")
        {
            Ok(client) => {
                info!("Connected to existing aria2c instance on port: {port}");
                Ok(client)
            }
            Err(err) => {
                error!("Failed to connect to existing aria2c instance on port {port}: {err}");
                Err(err)
            }
        }
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

        let v2_path = &*config_dir.join("config.json");
        let legacy_path = &*config_dir.join("torrentConfig").join("config.json");

        if !Path::new(&legacy_path).exists()
            && let Err(e) = write_cfg(v2_path, &FitLauncherConfigV2::default())
        {
            error!("Error writing default config: {}", e);
        }

        let final_config = load_or_migrate(legacy_path, v2_path);

        let aria2_client =
            match aria2_client_from_config(&final_config, aria2_session, v2_path).await {
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

        let v2_path = config_dir.join("config.json");
        let legacy_path = config_dir.join("torrentConfig").join("config.json");

        warn!("Config Path: {:?}", v2_path);

        let config = load_or_migrate(&legacy_path, &v2_path);
        let aria2_client = None;

        let shared = Arc::new(RwLock::new(Some(StateShared {
            config,
            aria2_client,
        })));

        Self {
            config_filename: v2_path.to_string_lossy().into(),
            shared,
            init_lock: Arc::new(tokio::sync::Mutex::new(())),
            aria2_child: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn aria2_client(&self) -> anyhow::Result<aria2_ws::Client> {
        let _guard = self.init_lock.lock().await;

        {
            let g = self.shared.read();
            if let Some(shared) = g.as_ref()
                && let Some(client) = &shared.aria2_client
            {
                return Ok(client.clone());
            }
        }

        warn!("Aria2 client not configured, attempting initialization...");
        self.init_client().await?;

        let g = self.shared.read();
        if let Some(shared) = g.as_ref()
            && let Some(client) = &shared.aria2_client
        {
            return Ok(client.clone());
        }

        Err(anyhow::anyhow!("Failed to initialize aria2 client"))
    }

    pub async fn configure(&self, config: FitLauncherConfigV2) -> Result<(), TorrentApiError> {
        if let Err(e) = write_cfg(&self.config_filename, &config) {
            error!("error writing config: {:#}", e);
        }

        let mut g = self.shared.write();
        *g = Some(StateShared {
            config,
            aria2_client: None,
        });
        Ok(())
    }

    pub async fn config(&self) -> FitLauncherConfigV2 {
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
        {
            let handles = {
                let mut guard = ARIA2_DAEMON.lock().await;
                guard.take()
            };
            if let Some((close_tx, done_rx, _port)) = handles {
                let _ = close_tx.send(());
                let _ = done_rx.await;
            }
        }

        if let Some(mut child) = self.aria2_child.lock().await.take() {
            info!("Killing aria2c child process...");
            if let Err(e) = child.kill().await {
                error!("Failed to kill aria2c: {:?}", e);
            } else {
                let _ = child.wait().await;
            }
        }
    }
}
