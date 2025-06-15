use anyhow::Context;
use aria2_ws::Client;
use librqbit::{
    Api, PeerConnectionOptions, Session, SessionOptions, SessionPersistenceConfig,
    dht::PersistentDhtConfig,
};
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

use crate::{
    config::{FitLauncherConfig, FitLauncherConfigAria2},
    errors::TorrentApiError,
};

type AriaDaemonType = Lazy<Mutex<Option<(Sender<()>, Receiver<()>)>>>;

pub static ARIA2_DAEMON: AriaDaemonType = Lazy::new(|| Mutex::new(None));

struct StateShared {
    config: FitLauncherConfig,
    aria2_client: Option<Client>,
}

pub struct TorrentSession {
    pub config_filename: String,
    shared: Arc<RwLock<Option<StateShared>>>,
}

fn read_config(path: &str) -> anyhow::Result<FitLauncherConfig> {
    let rdr = BufReader::new(File::open(path)?);
    let mut config: FitLauncherConfig = serde_json::from_reader(rdr)?;
    config.persistence.fix_backwards_compat();
    Ok(config)
}

fn write_config(path: &str, config: &FitLauncherConfig) -> anyhow::Result<()> {
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

pub async fn aria2_client_from_config(
    config: &FitLauncherConfig,
    session_path: impl AsRef<OsStr>,
) -> anyhow::Result<aria2_ws::Client> {
    let FitLauncherConfigAria2 {
        port,
        token,
        start_daemon,
    } = &config.aria2_rpc;

    let download_location = &config.default_download_location;

    if *start_daemon && ARIA2_DAEMON.lock().is_none() {
        #[cfg(not(debug_assertions))]
        let mut child = Command::new(if cfg!(windows) { "./aria2c" } else { "aria2c" })
            .arg("--enable-rpc")
            .arg(format!("--rpc-listen-port={port}"))
            .arg("--max-connection-per-server=5")
            .arg("--save-session")
            .arg(session_path.as_ref())
            .current_dir(download_location)
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
                    let _ = client_clone.shutdown().await;
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

pub async fn api_from_config(config: &FitLauncherConfig) -> anyhow::Result<Api> {
    config
        .validate()
        .context("error validating configuration")?;
    let persistence = if config.persistence.disable {
        None
    } else {
        Some(SessionPersistenceConfig::Json {
            folder: if config.persistence.folder == Path::new("") {
                None
            } else {
                Some(config.persistence.folder.clone())
            },
        })
    };
    let session = Session::new_with_opts(
        config.default_download_location.clone(),
        SessionOptions {
            disable_dht: config.dht.disable,
            disable_dht_persistence: config.dht.disable_persistence,
            dht_config: Some(PersistentDhtConfig {
                config_filename: Some(config.dht.persistence_filename.clone()),
                ..Default::default()
            }),
            persistence,
            peer_opts: Some(PeerConnectionOptions {
                connect_timeout: Some(config.peer_opts.connect_timeout),
                read_write_timeout: Some(config.peer_opts.read_write_timeout),
                ..Default::default()
            }),
            listen_port_range: if !config.tcp_listen.disable {
                Some(config.tcp_listen.min_port..config.tcp_listen.max_port)
            } else {
                None
            },
            enable_upnp_port_forwarding: !config.upnp.disable_tcp_port_forward,
            fastresume: config.persistence.fastresume,
            ..Default::default()
        },
    )
    .await
    .context("couldn't set up librqbit session")?;

    let api = Api::new(session.clone(), None, None);

    Ok(api)
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
            match write_config(&config_filename, &FitLauncherConfig::default()) {
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

    pub async fn configure(&self, config: FitLauncherConfig) -> Result<(), TorrentApiError> {
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

    pub async fn get_config(&self) -> FitLauncherConfig {
        let g = self.shared.read();
        if let Some(shared) = g.as_ref() {
            shared.config.clone()
        } else {
            warn!(
                "Tried to somehow get config before any initialization, has returned default config"
            );
            FitLauncherConfig::default()
        }
    }
}
