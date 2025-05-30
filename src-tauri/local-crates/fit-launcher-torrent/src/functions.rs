use std::{
    ffi::OsStr,
    fs::{File, OpenOptions},
    io::{BufReader, BufWriter},
    path::Path,
    process::Command,
    sync::Arc,
};

use anyhow::Context;
use aria2_ws::Client;
use http::StatusCode;
use librqbit::{
    Api, ApiError, PeerConnectionOptions, Session, SessionOptions, SessionPersistenceConfig,
    dht::PersistentDhtConfig,
};
use once_cell::sync::Lazy;
use parking_lot::{Mutex, RwLock};

use tokio::sync::oneshot::{Receiver, Sender, channel};

use tracing::{error, info, warn};

use crate::config::{FitLauncherConfig, FitLauncherConfigAria2};

const ERR_NOT_CONFIGURED: ApiError =
    ApiError::new_from_text(StatusCode::FAILED_DEPENDENCY, "not configured");

pub static ARIA2_DAEMON: Lazy<Mutex<Option<(Sender<()>, Receiver<()>)>>> =
    Lazy::new(|| Mutex::new(None));

struct StateShared {
    config: FitLauncherConfig,
    api: Option<Api>,
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

    // avoid start daemon after spawned
    if *start_daemon && ARIA2_DAEMON.lock().is_none() {
        // we must ship with a modified `aria2c.exe` on windows, with `SUBSYSTEM:WINDOWS`
        // for native linux, they could install aria2 via package managers.
        let mut child = Command::new(if cfg!(windows) { "./aria2c" } else { "aria2c" })
            .arg("--enable-rpc")
            .arg(format!("--rpc-listen-port={port}"))
            .arg("--max-connection-per-server=5")
            .arg("--save-session")
            .arg(session_path.as_ref())
            .current_dir(download_location)
            .spawn()?;

        let client =
            aria2_ws::Client::connect(&format!("ws://127.0.0.1:{port}/jsonrpc"), token.as_deref())
                .await?;
        let (close_tx, close_rx) = channel();
        let (done_tx, done_rx) = channel();
        tokio::task::spawn(async move {
            match close_rx.await {
                Ok(_) => {
                    let _ = client.shutdown().await;
                    let _ = child.wait();
                    let _ = done_tx.send(());
                }
                Err(_) => {
                    error!("close_tx closed unexceptedly, fail to close aria2 gracefully");
                }
            }
        });
        let _ = ARIA2_DAEMON.lock().replace((close_tx, done_rx));
    }

    Ok(
        aria2_ws::Client::connect(&format!("ws://127.0.0.1:{port}/jsonrpc"), token.as_deref())
            .await?,
    )
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
            // If it doesn't exist, write the default config
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
            let api = api_from_config(&config)
                .await
                .inspect_err(|e| {
                    warn!(error=?e, "error reading configuration");
                })
                .ok();
            let aria2_client = aria2_client_from_config(&config, aria2_session)
                .await
                .inspect_err(|e| {
                    warn!(error=?e, "aria2 not avaliable: {e}");
                })
                .ok();
            let shared = Arc::new(RwLock::new(Some(StateShared {
                config,
                api,
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

    pub(crate) fn api(&self) -> Result<Api, ApiError> {
        let g = self.shared.read();
        if g.is_none() {
            warn!("Shared state is uninitialized");
        }
        match g.as_ref().and_then(|s| s.api.as_ref()) {
            Some(api) => Ok(api.clone()),
            None => Err(ERR_NOT_CONFIGURED),
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

    pub async fn configure(&self, config: FitLauncherConfig) -> Result<(), ApiError> {
        {
            let g = self.shared.read();
            if let Some(shared) = g.as_ref() {
                if shared.api.is_some() && shared.config == config {
                    // The config didn't change, and the API is running, nothing to do.
                    return Ok(());
                }
            }
        }

        let existing = self.shared.write().as_mut().and_then(|s| s.api.take());

        if let Some(api) = existing {
            api.session().stop().await;
        }

        let api = api_from_config(&config).await?;

        let config_dir = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_dir() // Points to AppData\Roaming (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub");
        let aria2_session = config_dir.join("aria2.session");

        let aria2_client = aria2_client_from_config(&config, aria2_session).await.ok();

        if let Err(e) = write_config(&self.config_filename, &config) {
            error!("error writing config: {:#}", e);
        }

        let mut g = self.shared.write();
        *g = Some(StateShared {
            config,
            api: Some(api),
            aria2_client,
        });
        Ok(())
    }

    pub async fn get_config(&self) -> FitLauncherConfig {
        // Attempt to acquire the read lock
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
