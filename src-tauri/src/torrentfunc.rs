mod torrent_config;

use std::{
    fs::{File, OpenOptions},
    io::{BufReader, BufWriter},
    path::Path,
    sync::Arc,
};

use anyhow::Context;
use http::StatusCode;
use librqbit::{
    dht::PersistentDhtConfig, Api, ApiError, PeerConnectionOptions, Session, SessionOptions,
    SessionPersistenceConfig,
};
use parking_lot::RwLock;
use torrent_config::FitLauncherConfig;
use tracing::{error, info, warn};

const ERR_NOT_CONFIGURED: ApiError =
    ApiError::new_from_text(StatusCode::FAILED_DEPENDENCY, "not configured");

struct StateShared {
    config: torrent_config::FitLauncherConfig,
    api: Option<Api>,
}

pub struct State {
    config_filename: String,
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

async fn api_from_config(config: &FitLauncherConfig) -> anyhow::Result<Api> {
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

impl State {
    pub async fn new() -> Self {
        warn!("Starting Initialization");
        let config_filename = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_dir() // Points to AppData\Roaming (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub")
            .join("torrentConfig")
            .join("config.json")
            .to_str()
            .unwrap_or("ERROR")
            .to_owned();
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
                .map_err(|e| {
                    warn!(error=?e, "error reading configuration");
                    e
                })
                .ok();
            let shared = Arc::new(RwLock::new(Some(StateShared { config, api })));

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

    fn api(&self) -> Result<Api, ApiError> {
        let g = self.shared.read();
        if g.is_none() {
            warn!("Shared state is uninitialized");
        }
        match g.as_ref().and_then(|s| s.api.as_ref()) {
            Some(api) => Ok(api.clone()),
            None => Err(ERR_NOT_CONFIGURED),
        }
    }

    async fn configure(&self, config: FitLauncherConfig) -> Result<(), ApiError> {
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
        if let Err(e) = write_config(&self.config_filename, &config) {
            error!("error writing config: {:#}", e);
        }

        let mut g = self.shared.write();
        *g = Some(StateShared {
            config,
            api: Some(api),
        });
        Ok(())
    }

    async fn get_config(&self) -> FitLauncherConfig {
        // Attempt to acquire the read lock
        let g = self.shared.read();
        if let Some(shared) = g.as_ref() {
            shared.config.clone()
        } else {
            warn!("Tried to somehow get config before any initialization, has returned default config");
            FitLauncherConfig::default()
        }
    }
}

pub mod torrent_commands {

    use std::path::PathBuf;

    use super::*;

    use librqbit::{
        api::{
            ApiAddTorrentResponse, EmptyJsonResponse, TorrentDetailsResponse, TorrentIdOrHash,
            TorrentListResponse, TorrentStats,
        },
        AddTorrent, AddTorrentOptions, ApiError,
    };

    #[tauri::command]
    pub fn torrents_list(state: tauri::State<State>) -> Result<TorrentListResponse, ApiError> {
        Ok(state.api()?.api_torrent_list())
    }

    #[tauri::command]
    pub async fn torrent_create_from_url(
        state: tauri::State<'_, State>,
        url: String,
        opts: Option<AddTorrentOptions>,
    ) -> Result<ApiAddTorrentResponse, ApiError> {
        state
            .api()?
            .api_add_torrent(AddTorrent::Url(url.into()), opts)
            .await
    }

    #[tauri::command]
    pub async fn torrent_details(
        state: tauri::State<'_, State>,
        id: TorrentIdOrHash,
    ) -> Result<TorrentDetailsResponse, ApiError> {
        state.api()?.api_torrent_details(id)
    }

    #[tauri::command]
    pub async fn torrent_stats(
        state: tauri::State<'_, State>,
        id: TorrentIdOrHash,
    ) -> Result<TorrentStats, ApiError> {
        state.api()?.api_stats_v1(id)
    }

    #[tauri::command]
    pub async fn torrent_action_delete(
        state: tauri::State<'_, State>,
        id: TorrentIdOrHash,
    ) -> Result<EmptyJsonResponse, ApiError> {
        state.api()?.api_torrent_action_delete(id).await
    }

    #[tauri::command]
    pub async fn torrent_action_pause(
        state: tauri::State<'_, State>,
        id: TorrentIdOrHash,
    ) -> Result<EmptyJsonResponse, ApiError> {
        state.api()?.api_torrent_action_pause(id).await
    }

    #[tauri::command]
    pub async fn torrent_action_forget(
        state: tauri::State<'_, State>,
        id: TorrentIdOrHash,
    ) -> Result<EmptyJsonResponse, ApiError> {
        state.api()?.api_torrent_action_forget(id).await
    }

    #[tauri::command]
    pub async fn torrent_action_start(
        state: tauri::State<'_, State>,
        id: TorrentIdOrHash,
    ) -> Result<EmptyJsonResponse, ApiError> {
        state.api()?.api_torrent_action_start(id).await
    }

    #[tauri::command]
    pub async fn config_change_full_config(
        state: tauri::State<'_, State>,
        config: FitLauncherConfig,
    ) -> Result<EmptyJsonResponse, ApiError> {
        state.configure(config).await.map(|_| EmptyJsonResponse {})
    }

    #[tauri::command]
    pub async fn config_change_only_path(
        state: tauri::State<'_, State>,
        download_path: String,
    ) -> Result<EmptyJsonResponse, ApiError> {
        // Get the current config
        let mut current_config = state.get_config().await;
        // Convert the string path to a PathBuf and update the default_download_location
        current_config.default_download_location = PathBuf::from(download_path);

        // Save the updated config
        state
            .configure(current_config)
            .await
            .map(|_| EmptyJsonResponse {})
    }
}
