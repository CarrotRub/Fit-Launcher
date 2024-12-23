pub mod settings_creation {
    use directories::BaseDirs;
    use serde::{Deserialize, Serialize};
    use std::{fs, io::Write};
    use tracing::error;

    #[derive(Debug, Serialize, Deserialize)]
    pub struct InstallationSettings {
        pub auto_clean: bool,
        pub auto_install: bool,
        pub two_gb_limit: bool,
        pub directx_install: bool,
        pub microsoftcpp_install: bool,
    }

    impl Default for InstallationSettings {
        fn default() -> Self {
            InstallationSettings {
                auto_clean: true,
                auto_install: true,
                two_gb_limit: true,
                directx_install: true,
                microsoftcpp_install: true,
            }
        }
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct GamehubSettings {
        nsfw_censorship: bool,
        auto_get_colors_popular_games: bool,
    }

    impl Default for GamehubSettings {
        fn default() -> Self {
            GamehubSettings {
                nsfw_censorship: true,
                auto_get_colors_popular_games: true,
            }
        }
    }

    pub fn create_installation_settings_file() -> Result<(), std::io::Error> {
        let base_dirs = BaseDirs::new().expect("Failed to determine base directories");
        let installation_folder_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("installation");

        if !installation_folder_path.exists() {
            fs::create_dir_all(&installation_folder_path)
                .expect("Failed to create Installation Config directory");
        }

        let installation_file_path = installation_folder_path.join("installation.json");
        let default_config = InstallationSettings::default();

        let default_config_data = serde_json::to_string_pretty(&default_config).map_err(|err| {
            error!(
                "Failed to serialize default Installation config: {:#?}",
                err
            );
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Serialization of default Installation config failed",
            )
        })?;

        if !installation_file_path.exists() {
            let mut file = fs::File::create(&installation_file_path).map_err(|err| {
                error!("Error creating the file: {:#?}", err);
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Directory not found for creating installation file",
                )
            })?;

            file.write_all(default_config_data.as_bytes())
                .map_err(|err| {
                    error!("Failed to write to installation.json file: {:#?}", err);
                    std::io::Error::new(
                        std::io::ErrorKind::WriteZero,
                        "Failed to write data to installation.json",
                    )
                })?;
        }

        let library_settings_dir = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("library");

        // Ensure the library directory exists
        if !library_settings_dir.exists() {
            fs::create_dir_all(&library_settings_dir)
                .expect("Failed to create Installation Config directory");
        }

        // Define paths for specific files/directories within library settings
        let downloaded_games_file = library_settings_dir
            .join("downloadedGames")
            .join("downloaded_games.json");
        let collections_dir = library_settings_dir.join("collections");

        // Ensure the downloadedGames directory and its file exist
        if !downloaded_games_file.parent().unwrap().exists() {
            fs::create_dir_all(downloaded_games_file.parent().unwrap())
                .expect("Failed to create downloadedGames directory");
        }
        if !downloaded_games_file.exists() {
            let mut file = fs::File::create(downloaded_games_file)
                .expect("Failed to create downloaded_games.json file");
            file.write_all(b"[]")
                .expect("Failed to write to downloaded_games.json file");
        } else {
            let metadata =
                fs::metadata(&downloaded_games_file).expect("Failed to get file metadata");
            if metadata.len() == 0 {
                // If the file is empty, write "{}"
                let mut file = fs::File::create(&downloaded_games_file)
                    .expect("Failed to open downloaded_games.json file for writing");
                file.write_all(b"{}")
                    .expect("Failed to write to downloaded_games.json file");
            }
        }
        // Ensure the collections directory exists
        if !collections_dir.exists() {
            fs::create_dir_all(&collections_dir).expect("Failed to create collections directory");
        }
        Ok(())
    }

    pub fn create_gamehub_settings_file() -> Result<(), std::io::Error> {
        let base_dirs = BaseDirs::new().expect("Failed to determine base directories");
        let installation_folder_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("gamehub");

        if !installation_folder_path.exists() {
            fs::create_dir_all(&installation_folder_path)
                .expect("Failed to create Gamehub Config directory");
        }

        let installation_file_path = installation_folder_path.join("gamehub.json");
        let default_config = GamehubSettings::default();

        let default_config_data = serde_json::to_string_pretty(&default_config).map_err(|err| {
            error!("Failed to serialize default Gamehub config: {:#?}", err);
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Serialization of default Gamehub config failed",
            )
        })?;

        if !installation_file_path.exists() {
            let mut file = fs::File::create(&installation_file_path).map_err(|err| {
                error!("Error creating the file: {:#?}", err);
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Directory not found for creating installation file",
                )
            })?;

            file.write_all(default_config_data.as_bytes())
                .map_err(|err| {
                    error!("Failed to write to installation.json file: {:#?}", err);
                    std::io::Error::new(
                        std::io::ErrorKind::WriteZero,
                        "Failed to write data to installation.json",
                    )
                })?;
        }
        Ok(())
    }

    pub fn create_image_cache_file() -> Result<(), std::io::Error> {
        let base_dirs = BaseDirs::new().expect("Failed to determine base directories");
        let image_cache_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("image_cache.json");

        if !image_cache_file_path.exists() {
            fs::File::create(&image_cache_file_path).map_err(|err| {
                error!("Error creating the file: {:#?}", err);
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Directory not found for creating installation file",
                )
            })?;
        }
        Ok(())
    }
}

pub mod settings_configuration {
    use directories::BaseDirs;
    use serde::Serialize;
    use std::fmt;
    use std::fs;
    use tracing::error;
    use tracing::info;

    use crate::net_client_config::custom_client_dns::FitLauncherDnsConfig;

    use super::settings_creation::GamehubSettings;
    use super::settings_creation::InstallationSettings;

    #[derive(Debug, Serialize)]
    pub struct SettingsConfigurationError {
        message: String,
    }

    impl fmt::Display for SettingsConfigurationError {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }

    impl std::error::Error for SettingsConfigurationError {}

    impl From<reqwest::Error> for SettingsConfigurationError {
        fn from(error: reqwest::Error) -> Self {
            SettingsConfigurationError {
                message: error.to_string(),
            }
        }
    }

    impl From<std::io::Error> for SettingsConfigurationError {
        fn from(error: std::io::Error) -> Self {
            SettingsConfigurationError {
                message: error.to_string(),
            }
        }
    }

    impl From<serde_json::Error> for SettingsConfigurationError {
        fn from(error: serde_json::Error) -> Self {
            SettingsConfigurationError {
                message: error.to_string(),
            }
        }
    }

    #[tauri::command]
    pub fn get_installation_settings() -> InstallationSettings {
        let base_dirs = BaseDirs::new()
            .ok_or_else(|| error!("Failed to determine base directories"))
            .unwrap();

        let installation_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("installation")
            .join("installation.json");

        let file_content = fs::read_to_string(&installation_file_path)
            .map_err(|err| {
                error!(
                    "Error reading the file at {:?}: {:#?}",
                    installation_file_path, err
                );
            })
            .unwrap_or("{}".to_string());

        serde_json::from_str::<InstallationSettings>(&file_content).unwrap_or_default()
    }

    #[tauri::command]
    pub fn get_gamehub_settings() -> GamehubSettings {
        let base_dirs = BaseDirs::new()
            .ok_or_else(|| error!("Failed to determine base directories"))
            .unwrap();

        let installation_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("gamehub")
            .join("gamehub.json");

        let file_content = fs::read_to_string(&installation_file_path)
            .map_err(|err| {
                error!(
                    "Error reading the file at {:?}: {:#?}",
                    installation_file_path, err
                );
            })
            .unwrap_or("{}".to_string());

        serde_json::from_str::<GamehubSettings>(&file_content).unwrap_or_default()
    }

    #[tauri::command]
    pub fn get_dns_settings() -> FitLauncherDnsConfig {
        let base_dirs = BaseDirs::new()
            .ok_or_else(|| error!("Failed to determine base directories"))
            .unwrap();

        let installation_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("dns")
            .join("dns.json");

        let file_content = fs::read_to_string(&installation_file_path)
            .map_err(|err| {
                error!(
                    "Error reading the file at {:?}: {:#?}",
                    installation_file_path, err
                );
            })
            .unwrap_or("{}".to_string());

        serde_json::from_str::<FitLauncherDnsConfig>(&file_content).unwrap_or_default()
    }

    #[tauri::command]
    pub fn change_installation_settings(
        settings: InstallationSettings,
    ) -> Result<(), SettingsConfigurationError> {
        let base_dirs = BaseDirs::new().ok_or_else(|| SettingsConfigurationError {
            message: "Failed to determine base directories".to_string(),
        })?;
        let installation_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("installation")
            .join("installation.json");

        let settings_json_string =
            serde_json::to_string_pretty(&settings).map_err(SettingsConfigurationError::from)?;

        fs::write(installation_file_path, settings_json_string)
            .map_err(SettingsConfigurationError::from)?;
        Ok(())
    }

    #[tauri::command]
    pub fn change_gamehub_settings(
        settings: GamehubSettings,
    ) -> Result<(), SettingsConfigurationError> {
        let base_dirs = BaseDirs::new().ok_or_else(|| SettingsConfigurationError {
            message: "Failed to determine base directories".to_string(),
        })?;
        let installation_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("gamehub")
            .join("gamehub.json");

        let settings_json_string =
            serde_json::to_string_pretty(&settings).map_err(SettingsConfigurationError::from)?;

        fs::write(installation_file_path, settings_json_string)
            .map_err(SettingsConfigurationError::from)?;
        Ok(())
    }

    #[tauri::command]
    pub fn change_dns_settings(
        settings: FitLauncherDnsConfig,
    ) -> Result<(), SettingsConfigurationError> {
        let base_dirs = BaseDirs::new().ok_or_else(|| SettingsConfigurationError {
            message: "Failed to determine base directories".to_string(),
        })?;
        let installation_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("dns")
            .join("dns.json");

        let settings_json_string =
            serde_json::to_string_pretty(&settings).map_err(SettingsConfigurationError::from)?;

        fs::write(installation_file_path, settings_json_string)
            .map_err(SettingsConfigurationError::from)?;
        Ok(())
    }

    #[tauri::command]
    pub fn reset_installation_settings() -> Result<(), SettingsConfigurationError> {
        let base_dirs = BaseDirs::new().ok_or_else(|| SettingsConfigurationError {
            message: "Failed to determine base directories".to_string(),
        })?;
        let installation_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("installation")
            .join("installation.json");

        let settings_json_string = serde_json::to_string_pretty(&InstallationSettings::default())
            .map_err(SettingsConfigurationError::from)?;

        fs::write(installation_file_path, settings_json_string)
            .map_err(SettingsConfigurationError::from)?;
        Ok(())
    }

    #[tauri::command]
    pub fn reset_gamehub_settings() -> Result<(), SettingsConfigurationError> {
        let base_dirs = BaseDirs::new().ok_or_else(|| SettingsConfigurationError {
            message: "Failed to determine base directories".to_string(),
        })?;
        let gamehub_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("gamehub")
            .join("gamehub.json");

        let settings_json_string = serde_json::to_string_pretty(&GamehubSettings::default())
            .map_err(SettingsConfigurationError::from)?;

        fs::write(gamehub_file_path, settings_json_string)
            .map_err(SettingsConfigurationError::from)?;
        Ok(())
    }

    #[tauri::command]
    pub fn reset_dns_settings() -> Result<(), SettingsConfigurationError> {
        let base_dirs = BaseDirs::new().ok_or_else(|| SettingsConfigurationError {
            message: "Failed to determine base directories".to_string(),
        })?;
        let dns_file_path = base_dirs
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("dns")
            .join("dns.json");

        let settings_json_string = serde_json::to_string_pretty(&FitLauncherDnsConfig::default())
            .map_err(SettingsConfigurationError::from)?;

        fs::write(dns_file_path, settings_json_string).map_err(SettingsConfigurationError::from)?;
        Ok(())
    }

    #[tauri::command]
    pub async fn clear_all_cache() -> Result<(), SettingsConfigurationError> {
        let persistence_session_path = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_local_dir() // Points to AppData\Local (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub")
            .join("torrentConfig")
            .join("session")
            .join("data");
        let persistnce_dht_path = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_local_dir() // Points to AppData\Local (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub")
            .join("torrentConfig")
            .join("dht")
            .join("cache");

        let image_cache_path = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_local_dir() // Points to AppData\Local (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub")
            .join("image_cache.json");

        tokio::fs::remove_dir_all(persistence_session_path).await?;
        tokio::fs::remove_dir_all(persistnce_dht_path).await?;
        tokio::fs::remove_file(image_cache_path).await?;
        Ok(())
    }

    #[tauri::command]
    pub fn open_logs_directory() -> Result<(), String> {
        let path = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("logs");

        // Detect OS
        if cfg!(target_os = "windows") {
            match std::process::Command::new("explorer").arg(path).spawn() {
                Ok(child) => {
                    info!("file explorer started with PID: {}", child.id());
                }
                Err(e) => {
                    error!("Failed to start file explorer: {}", e);
                }
            }
        } else if cfg!(target_os = "macos") {
            match std::process::Command::new("open").arg(path).spawn() {
                Ok(child) => {
                    info!("file explorer started with PID: {}", child.id());
                }
                Err(e) => {
                    error!("Failed to start file explorer: {}", e);
                }
            }
        } else {
            match std::process::Command::new("xdg-open").arg(path).spawn() {
                Ok(child) => {
                    info!("file explorer started with PID: {}", child.id());
                }
                Err(e) => {
                    error!("Failed to start file explorer: {}", e);
                }
            }
        }

        Ok(())
    }
}
