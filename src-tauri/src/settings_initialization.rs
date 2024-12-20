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
}

pub mod settings_configuration {
    use directories::BaseDirs;
    use serde::Serialize;
    use std::fmt;
    use std::fs;
    use tracing::error;

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
}
