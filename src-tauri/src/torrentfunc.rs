pub mod torrent_calls {

    use anyhow::Context; // For handling JSON
    use librqbit::api::TorrentIdOrHash;
    //TODO: Add DHT Persistence
    use librqbit::dht::{Id20, PersistentDhtConfig};
    use librqbit::{
        AddTorrent, AddTorrentOptions, Api, Magnet, Session, SessionOptions,
        SessionPersistenceConfig, TorrentStats,
    };
    use serde::{Deserialize, Serialize, Serializer};
    use std::fs;
    use std::str::FromStr;
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::sync::{mpsc, Mutex};
    use tracing::{error, info};

    #[cfg(target_os = "windows")]
    use crate::custom_ui_automation::windows_ui_automation;
    use crate::executable_custom_commands;

    #[derive(Default)]
    pub struct TorrentState {
        pub torrent_manager: Arc<Mutex<Option<Arc<Mutex<TorrentManager>>>>>,
    }

    #[derive(Debug, Serialize, thiserror::Error)]
    pub enum TorrentError {
        #[error("Anyhow Error: {0}")]
        AnyhowError(String),

        #[error("Modifying JSON Error: {0}")]
        FileJSONError(String),

        #[error("Error While Creating And Manipulating The Regex: {0}")]
        RegexError(String),
    }

    impl From<anyhow::Error> for TorrentError {
        fn from(error: anyhow::Error) -> Self {
            TorrentError::AnyhowError(error.to_string())
        }
    }

    impl From<serde_json::Error> for TorrentError {
        fn from(error: serde_json::Error) -> Self {
            TorrentError::FileJSONError(error.to_string())
        }
    }

    impl From<regex::Error> for TorrentError {
        fn from(error: regex::Error) -> Self {
            TorrentError::RegexError(error.to_string())
        }
    }

    // Custom Struct that contains crucial informations about the torrent for usage in the frontend and also backend.
    #[derive(Debug, Serialize, Deserialize)]
    pub struct TorrentCoreInfo {
        torrent_name: String,
        torrent_files_names: Vec<String>,
        torrent_output_folder: String,
        torrent_idx: TorrentIdOrHash,
    }

    impl TorrentCoreInfo {
        fn new() -> Self {
            TorrentCoreInfo {
                torrent_name: String::new(),
                torrent_files_names: Vec::new(),
                torrent_output_folder: String::new(),
                torrent_idx: TorrentIdOrHash::Hash(
                    Id20::from_str("0000000000000000000000000000000000000000").unwrap(),
                ),
            }
        }
    }

    #[derive(Debug, Deserialize, Serialize)]
    struct TorrentServerConfig {
        pub listen_port_range: Option<std::ops::Range<u16>>,
        pub enable_upnp_port_forwarding: bool,
    }

    #[derive(Debug, Deserialize, Serialize)]
    struct TorrentDiskConfig {
        pub defer_writes_up_to: Option<usize>,
    }

    //TODO: Add socks_proxy_url
    #[derive(Debug, Deserialize, Serialize)]
    struct TorrentTorrentingConfig {
        pub fastresume: bool,
        pub concurrent_init_limit: Option<usize>,
    }

    #[derive(Debug, Deserialize, Serialize)]
    struct TorrentConfig {
        pub server_config: TorrentServerConfig,
        pub disk_config: TorrentDiskConfig,
        pub torrenting_config: TorrentTorrentingConfig,
    }

    impl TorrentConfig {
        // Provide default values for TorrentConfig
        pub fn default() -> Self {
            TorrentConfig {
                server_config: TorrentServerConfig {
                    listen_port_range: Some(6881..6889),
                    enable_upnp_port_forwarding: true,
                },
                disk_config: TorrentDiskConfig {
                    defer_writes_up_to: None, // None for SSD and 4096 (4mB) for HDD
                },
                torrenting_config: TorrentTorrentingConfig {
                    fastresume: true,
                    concurrent_init_limit: Some(1), // For now let's stick with one, we will add more later on
                },
            }
        }

        pub fn new(config_path: &str) -> Self {
            let content = match fs::read_to_string(config_path) {
                Ok(content) => content,
                Err(err) => {
                    error!("Error while reading TOML config file: {:#?}", err);
                    return Self::create_default_toml(config_path);
                }
            };

            match toml::from_str(&content) {
                Ok(configuration) => configuration,
                Err(err) => {
                    error!("Error while parsing TOML file: {:#?}", err);
                    panic!("Failed to parse config file.");
                }
            }
        }

        // Create a default TOML file if it doesn't exist, return default_config
        fn create_default_toml(config_path: &str) -> Self {
            let default_config = Self::default();
            let toml_string =
                toml::to_string(&default_config).expect("Failed to serialize default config");

            match fs::write(config_path, toml_string) {
                Ok(_) => info!("Default TOML configuration created at: {}", config_path),
                Err(err) => error!("Failed to create default TOML file: {:#?}", err),
            }

            default_config
        }
    }

    // Define a struct that holds the Api Session
    pub struct TorrentManager {
        api_session: Arc<Api>,
    }

    impl TorrentManager {
        /// Asynchronously creates a new `TorrentManager` with custom session options.
        ///
        /// This method sets up a new torrent session with specific configurations for persistence, DHT, and other session options.
        /// It also initializes the necessary channels for managing API communication within the session.
        ///
        /// # Parameters
        /// - `download_path`: A `String` representing the path where the downloaded torrent files will be stored.
        /// - `app_cache_patch`: A `String` representing the path used for storing session and DHT persistence files.
        ///
        /// # Returns
        /// This method returns a `Result`:
        /// - On success, it returns an instance of `TorrentManager`.
        /// - On failure, it returns a `Box<TorrentError>` containing an error if the session creation fails.
        ///
        /// # Session Configuration
        /// - `persistence`: Configured with a JSON persistence folder using `app_cache_patch`.
        /// - `DHT`: Disabled by default but will be added later.
        /// - `UPnP Port Forwarding`: Enabled.
        /// - `Port Range`: The session listens on port range 6881-6889.
        /// - `Fast Resume`: Enabled to quickly resume torrent sessions.
        /// - `Defer Writes`: Currently disabled, but can be configured for slow disks to defer writes up to a certain size.
        /// - `Concurrent Initialization Limit`: Set to 1 for limiting concurrent initializations.
        ///
        /// # TODO
        /// - Add functionality for users to choose between HDD and SSD configurations for better performance.
        /// - Enable DHT persistence in future updates.
        ///
        /// # Errors
        /// This method will return an error if the torrent session fails to initialize or if any configuration options cause issues.
        pub async fn new(
            download_path: String,
            app_cache_patch: String,
            app_settings_path: String,
        ) -> Result<Self, Box<TorrentError>> {
            // let magnet_id20 = Magnet::parse(&magnet_link).unwrap().as_id20().unwrap();

            let config_file_path =
                format!("{}fitgirlConfig\\torrent_config.toml", app_settings_path).to_string();

            let torrent_config = TorrentConfig::new(&config_file_path);

            let persistence_path = format!("{}.persistence", app_cache_patch);
            let _dht_persistence_path = format!("{}.dht_persistence/", app_cache_patch);

            let persistence_config = Some(SessionPersistenceConfig::Json {
                folder: Some(persistence_path.into()),
            });

            // Not working, to be added later.
            // let _personal_dht_config = Some(PersistentDhtConfig {
            // config_filename: Some(persistence_path),
            // ..Default::default()
            // });

            // TODO: Add a way to either ask the user to choose between HDD or SSD (For a different config)

            let mut custom_session_options = SessionOptions::default();
            custom_session_options.disable_dht_persistence = true;
            custom_session_options.persistence = persistence_config;
            // custom_session_options.dht_config= personal_dht_config;
            custom_session_options.fastresume = torrent_config.torrenting_config.fastresume;
            custom_session_options.concurrent_init_limit =
                torrent_config.torrenting_config.concurrent_init_limit;
            custom_session_options.enable_upnp_port_forwarding =
                torrent_config.server_config.enable_upnp_port_forwarding;
            custom_session_options.listen_port_range =
                torrent_config.server_config.listen_port_range;
            custom_session_options.defer_writes_up_to =
                torrent_config.disk_config.defer_writes_up_to;

            let session_global: Arc<Session> =
                match Session::new_with_opts(download_path.into(), custom_session_options).await {
                    Ok(session) => session,
                    Err(err) => {
                        error!("Error while creating a new session: {:#?}", err);
                        return Err(Box::new(TorrentError::AnyhowError(err.to_string())));
                    }
                };

            let (tx, _rx) = mpsc::unbounded_channel();
            let option_tx: Option<mpsc::UnboundedSender<String>> = Some(tx);
            let cus_api_session = Arc::new(Api::new(session_global.clone(), option_tx));

            Ok(TorrentManager {
                api_session: cus_api_session,
            })
        }

        /// Asynchronously fetches detailed information about a torrent from a magnet link.
        ///
        /// This method sends a request to add the torrent (in a list-only mode), without actually downloading it.
        /// The result includes essential torrent details, such as the torrent name, file names, output folder, and the torrent identifier (either ID or hash).
        ///
        /// # Parameters
        /// - `magnet_link`: A `String` containing the magnet link for the torrent.
        ///
        /// # Returns
        /// This method returns a `Result`:
        /// - On success, it returns a `TorrentCoreInfo` struct containing:
        ///     - `torrent_name`: The name of the torrent (e.g., "Ubuntu ISO").
        ///     - `torrent_files_names`: A vector of file names associated with the torrent.
        ///     - `torrent_output_folder`: The folder where the torrent will be downloaded.
        ///     - `torrent_idx`: The torrent's identifier, either an ID or a hash value.
        /// - On failure, it returns a `Box<TorrentError>` containing an error related to adding the torrent.
        ///
        /// # Errors
        /// This method will return an error if there is an issue adding the torrent to the session.
        pub async fn get_torrent_details(
            &self,
            magnet_link: String,
        ) -> Result<TorrentCoreInfo, Box<TorrentError>> {
            let added_torrent_response = Api::api_add_torrent(
                &self.api_session,
                AddTorrent::from_url(&magnet_link),
                Some(AddTorrentOptions {
                    list_only: true,
                    ..Default::default()
                }),
            )
            .await
            .context("Error While Adding The Torrent To The Session")
            .unwrap();

            let files_names: Vec<String> = added_torrent_response
                .details
                .files
                .iter()
                .map(|file| file.name.clone())
                .collect();

            let mut core_info = TorrentCoreInfo::new();
            core_info.torrent_files_names = files_names;
            core_info.torrent_name = added_torrent_response.details.name.unwrap();
            core_info.torrent_output_folder = added_torrent_response.output_folder;
            core_info.torrent_idx = TorrentIdOrHash::Hash(
                Id20::from_str(&added_torrent_response.details.info_hash).unwrap(),
            );

            Ok(core_info)
        }

        /// Asynchronously downloads a torrent from a magnet link and handles automated installation processes.
        ///
        /// # Arguments
        ///
        /// * `magnet_link` - A `String` containing the magnet link for the torrent.
        /// * `file_list` - A `Vec<usize>` specifying which files within the torrent to download using their numbers.
        /// * `torrent_idx` - A `String` representing the torrent's unique hash or ID.
        /// * `torrent_output_folder` - A `String` specifying the folder where the torrent's files will be downloaded (Example : C:/Games/TorrentGames/SomeGame \[FitGirl Repack]\/).
        /// * `game_output_folder` - A `String` specifying the folder where the game files will be stored post-automation.
        /// * `checkboxes_list` - A `Vec<String>` of checkbox labels to be clicked during installation.
        /// * `two_gb_limit` - A `bool` indicating whether to enforce a 2GB file size limit.
        ///
        /// # Returns
        ///
        /// * `Ok(())` - If the torrent is successfully added, downloaded, and post-download tasks complete without error.
        /// * `Err(Box<TorrentError>)` - If there is an error during the torrent download or automation process.
        ///
        pub async fn download_torrent_with_args(
            &self,
            magnet_link: String,
            file_list: Vec<usize>,
        ) -> Result<(), Box<TorrentError>> {
            // First, delete all previous torrents from the session persistence to avoid any re-download, may be removed later when multiple downloads will be added but the concurrent_init_limit should be raised too.

            // Get the list response.
            let torrent_list_response = Api::api_torrent_list(&self.api_session);

            // Get the hash of the torrent that will be downloaded.
            let actual_torrent_magnet = match Magnet::parse(&magnet_link) {
                Ok(magnet) => magnet,
                Err(e) => {
                    error!("Error Parsing Magnet : {:#?}", e);
                    return Err(Box::new(TorrentError::AnyhowError(
                        "Error forgetting the torrent from the session persistence.".to_string(),
                    )));
                }
            };

            let actual_torrent_id20 = Magnet::as_id20(&actual_torrent_magnet);

            let actual_torrent_hash =
                TorrentIdOrHash::Hash(actual_torrent_id20.unwrap()).to_string();

            if !torrent_list_response.torrents.is_empty() {
                // Get the vector and transform it into an Iterator
                let torrent_list_iter = torrent_list_response.torrents.iter();

                for torrent in torrent_list_iter {
                    if torrent.info_hash != actual_torrent_hash {
                        match self.stop_torrent(torrent.info_hash.clone()).await {
                            Ok(()) => {
                                info!(
                                    "Forgot the torrent ID : {:#?} | Hash : {:#?}",
                                    &torrent.id, &torrent.info_hash
                                );
                            }
                            Err(e) => {
                                error!("Error forgetting the torrent from the session persistence : {:#?}", e);
                                return Err(Box::new(TorrentError::AnyhowError(
                                    "Error forgetting the torrent from the session persistence."
                                        .to_string(),
                                )));
                            }
                        }
                    }
                }
            }

            let _torrent_response = match Api::api_add_torrent(
                &self.api_session,
                AddTorrent::from_url(&magnet_link),
                Some(AddTorrentOptions {
                    only_files: Some(file_list),
                    overwrite: true,
                    disable_trackers: false,
                    force_tracker_interval: Some(Duration::from_secs(30)), // Check tracker every minute
                    ..Default::default()
                }),
            )
            .await
            {
                Ok(response) => {
                    info!(
                        "Torrent Was Successfully Added And The Installation Successfully Started"
                    );

                    Some(response)
                }
                Err(e) => {
                    error!("Error While Adding The Torrent To Download : {}", e);
                    None
                }
            };

            Ok(())
        }

        pub async fn automate_setup_install(
            &self,
            torrent_idx: String,
            torrent_output_folder: String,
            checkboxes_list: Vec<String>,
            two_gb_limit: bool,
        ) -> Result<(), Box<TorrentError>> {
            let torrent_hash = TorrentIdOrHash::Hash(Id20::from_str(&torrent_idx).unwrap());

            match Api::api_torrent_action_forget(&self.api_session, torrent_hash).await {
                Ok(_) => {
                    info!("Torrent Successfully Stopped");
                }
                Err(err) => {
                    error!("Torrent Couldn't Stop : {}", err)
                }
            }

            let setup_path = format!("{}\\setup.exe", torrent_output_folder);

            windows_ui_automation::start_executable_components_args(setup_path, &checkboxes_list);

            let game_output_folder = torrent_output_folder.replace(" [FitGirl Repack]", "");

            #[cfg(target_os = "windows")]
            windows_ui_automation::automate_until_download(
                checkboxes_list,
                &game_output_folder,
                two_gb_limit,
            )
            .await;

            #[cfg(target_os = "linux")]
            //TODO: Add linux automate_until_download command

            info!("Torrent has completed!");
            info!("Game Installation Has been Started");

            Ok(())
        }

        pub async fn get_torrent_stats(
            &self,
            torrent_idx: String,
        ) -> Result<Option<TorrentStats>, Box<TorrentError>> {
            let torrent_hash: TorrentIdOrHash =
                TorrentIdOrHash::Hash(Id20::from_str(&torrent_idx).unwrap());

            let torrent_stats = match Api::api_stats_v1(&self.api_session, torrent_hash) {
                Ok(response) => Some(response),

                Err(err) => {
                    error!("Error Getting Stats: {}", err);
                    None
                }
            };

            Ok(torrent_stats)
        }

        pub async fn pause_torrent(&self, torrent_idx: String) -> Result<(), Box<TorrentError>> {
            let torrent_hash: TorrentIdOrHash =
                TorrentIdOrHash::Hash(Id20::from_str(&torrent_idx).unwrap());

            match Api::api_torrent_action_pause(&self.api_session, torrent_hash).await {
                Ok(_) => {
                    info!("Torrent Successfully Paused");
                }
                Err(err) => {
                    error!("Torrent Couldn't Pause : {}", err)
                }
            }

            Ok(())
        }

        pub async fn stop_torrent(&self, torrent_idx: String) -> Result<(), Box<TorrentError>> {
            let torrent_hash: TorrentIdOrHash =
                TorrentIdOrHash::Hash(Id20::from_str(&torrent_idx).unwrap());

            // * Use forget because it will just remove it from the session and not delete the files
            match Api::api_torrent_action_forget(&self.api_session, torrent_hash).await {
                Ok(_) => {
                    info!("Torrent Successfully Stopped");
                }
                Err(err) => {
                    error!("Torrent Couldn't Stop : {}", err)
                }
            }

            Ok(())
        }

        pub async fn resume_torrent(&self, torrent_idx: String) -> Result<(), Box<TorrentError>> {
            let torrent_hash: TorrentIdOrHash =
                TorrentIdOrHash::Hash(Id20::from_str(&torrent_idx).unwrap());

            // * Use this to resume the function (It will take advantage of the fastresume option)
            match Api::api_torrent_action_start(&self.api_session, torrent_hash).await {
                Ok(_) => {
                    info!("Torrent Successfully Resumed");
                }
                Err(err) => {
                    error!("Torrent Couldn't Resume : {}", err)
                }
            }

            Ok(())
        }

        pub async fn delete_torrent(&self, torrent_idx: String) -> Result<(), Box<TorrentError>> {
            let torrent_hash: TorrentIdOrHash =
                TorrentIdOrHash::Hash(Id20::from_str(&torrent_idx).unwrap());

            match Api::api_torrent_action_delete(&self.api_session, torrent_hash).await {
                Ok(_) => {
                    info!("Torrent Successfully Resumed");
                }
                Err(err) => {
                    error!("Torrent Couldn't Resume : {}", err)
                }
            }

            Ok(())
        }
    }
}

pub mod torrent_commands {

    use librqbit::TorrentStats;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use tokio::task;
    use tracing::error;

    use super::torrent_calls::TorrentCoreInfo;
    use super::torrent_calls::TorrentError;
    use super::torrent_calls::TorrentManager;
    use super::torrent_calls::TorrentState;

    #[tauri::command]
    pub async fn api_initialize_torrent_manager(
        state: tauri::State<'_, TorrentState>,
        download_path: String,
        app_cache_path: String,
        app_settings_path: String,
    ) -> Result<(), Box<TorrentError>> {
        let manager = TorrentManager::new(download_path, app_cache_path, app_settings_path).await?;
        let mut torrent_manager = state.torrent_manager.lock().await;
        *torrent_manager = Some(Arc::new(Mutex::new(manager)));
        Ok(())
    }

    #[tauri::command]
    pub async fn api_get_torrent_details(
        state: tauri::State<'_, TorrentState>,
        magnet_link: String,
    ) -> Result<TorrentCoreInfo, Box<TorrentError>> {
        let torrent_manager = state.torrent_manager.lock().await;
        if let Some(manager) = &*torrent_manager {
            let manager = manager.lock().await; // Lock the manager for use
            let core_info = manager.get_torrent_details(magnet_link).await?;

            Ok(core_info)
        } else {
            Err(Box::new(TorrentError::AnyhowError(
                "TorrentManager is not initialized.".to_string(),
            )))
        }
    }

    #[tauri::command]
    pub async fn api_download_with_args(
        state: tauri::State<'_, TorrentState>,
        magnet_link: String,
        download_file_list: Vec<usize>,
    ) -> Result<(), Box<TorrentError>> {
        let torrent_manager = state.torrent_manager.lock().await;
        if let Some(manager) = &*torrent_manager {
            let manager = Arc::clone(manager);
            // Spawn a new async task to handle the download in a separate thread
            task::spawn(async move {
                let manager = manager.lock().await;
                if let Err(e) = manager
                    .download_torrent_with_args(magnet_link, download_file_list)
                    .await
                {
                    error!("Error downloading torrent: {:?}", e);
                }
            });

            Ok(())
        } else {
            Err(Box::new(TorrentError::AnyhowError(
                "TorrentManager is not initialized.".to_string(),
            )))
        }
    }

    #[tauri::command]
    pub async fn api_automate_setup_install(
        state: tauri::State<'_, TorrentState>,
        torrent_idx: String,
        torrent_output_folder: String,
        checkboxes_list: Vec<String>,
        two_gb_limit: bool,
    ) -> Result<(), Box<TorrentError>> {
        let torrent_manager = state.torrent_manager.lock().await;
        if let Some(manager) = &*torrent_manager {
            let manager = manager.lock().await;
            if let Err(e) = manager
                .automate_setup_install(
                    torrent_idx,
                    torrent_output_folder,
                    checkboxes_list,
                    two_gb_limit,
                )
                .await
            {
                error!("Error during the automation of the setup install: {:#?}", e);
            }

            Ok(())
        } else {
            Err(Box::new(TorrentError::AnyhowError(
                "TorrentManager is not initialized.".to_string(),
            )))
        }
    }

    #[tauri::command]
    pub async fn api_get_torrent_stats(
        state: tauri::State<'_, TorrentState>,
        torrent_idx: String,
    ) -> Result<TorrentStats, Box<TorrentError>> {
        let torrent_manager = state.torrent_manager.lock().await;
        if let Some(manager) = &*torrent_manager {
            let manager: tokio::sync::MutexGuard<'_, TorrentManager> = manager.lock().await; // Lock the manager for use
            let torrent_stats = manager.get_torrent_stats(torrent_idx).await?.unwrap();

            Ok(torrent_stats)
        } else {
            Err(Box::new(TorrentError::AnyhowError(
                "TorrentManager is not initialized.".to_string(),
            )))
        }
    }

    #[tauri::command]
    pub async fn api_pause_torrent(
        state: tauri::State<'_, TorrentState>,
        torrent_idx: String,
    ) -> Result<(), Box<TorrentError>> {
        let torrent_manager = state.torrent_manager.lock().await;
        if let Some(manager) = &*torrent_manager {
            let manager: tokio::sync::MutexGuard<'_, TorrentManager> = manager.lock().await; // Lock the manager for use
            manager.pause_torrent(torrent_idx).await?;

            Ok(())
        } else {
            Err(Box::new(TorrentError::AnyhowError(
                "TorrentManager is not initialized.".to_string(),
            )))
        }
    }

    #[tauri::command]
    pub async fn api_resume_torrent(
        state: tauri::State<'_, TorrentState>,
        torrent_idx: String,
    ) -> Result<(), Box<TorrentError>> {
        let torrent_manager = state.torrent_manager.lock().await;
        if let Some(manager) = &*torrent_manager {
            let manager: tokio::sync::MutexGuard<'_, TorrentManager> = manager.lock().await; // Lock the manager for use
            manager.resume_torrent(torrent_idx).await?;

            Ok(())
        } else {
            Err(Box::new(TorrentError::AnyhowError(
                "TorrentManager is not initialized.".to_string(),
            )))
        }
    }

    #[tauri::command]
    pub async fn api_stop_torrent(
        state: tauri::State<'_, TorrentState>,
        torrent_idx: String,
    ) -> Result<(), Box<TorrentError>> {
        let torrent_manager = state.torrent_manager.lock().await;
        if let Some(manager) = &*torrent_manager {
            let manager: tokio::sync::MutexGuard<'_, TorrentManager> = manager.lock().await; // Lock the manager for use
            manager.stop_torrent(torrent_idx).await?;

            Ok(())
        } else {
            Err(Box::new(TorrentError::AnyhowError(
                "TorrentManager is not initialized.".to_string(),
            )))
        }
    }

    #[tauri::command]
    pub async fn api_delete_torrent(
        state: tauri::State<'_, TorrentState>,
        torrent_idx: String,
    ) -> Result<(), Box<TorrentError>> {
        let torrent_manager = state.torrent_manager.lock().await;
        if let Some(manager) = &*torrent_manager {
            let manager: tokio::sync::MutexGuard<'_, TorrentManager> = manager.lock().await; // Lock the manager for use
            manager.delete_torrent(torrent_idx).await?;

            Ok(())
        } else {
            Err(Box::new(TorrentError::AnyhowError(
                "TorrentManager is not initialized.".to_string(),
            )))
        }
    }
}
