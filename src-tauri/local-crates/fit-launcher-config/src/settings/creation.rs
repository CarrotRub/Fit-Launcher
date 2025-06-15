use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::{fs, io::Write};
use tracing::error;

#[derive(Debug, Serialize, Deserialize, Type)]
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

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct GamehubSettings {
    nsfw_censorship: bool,
    auto_get_colors_popular_games: bool,
}

impl Default for GamehubSettings {
    fn default() -> Self {
        GamehubSettings {
            nsfw_censorship: true,
            auto_get_colors_popular_games: false,
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
        let metadata = fs::metadata(&downloaded_games_file).expect("Failed to get file metadata");
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
