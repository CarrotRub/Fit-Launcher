use directories::BaseDirs;
use specta::specta;
use std::fs;
use std::path::PathBuf;
use tracing::error;
use tracing::info;

use crate::SettingsConfigurationError;
use crate::client::cookies;
use crate::client::cookies::Cookies;
use crate::client::dns::FitLauncherDnsConfig;

use super::creation::GamehubSettings;
use super::creation::InstallationSettings;

#[tauri::command]
#[specta]
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
#[specta]
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
#[specta]
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
#[specta]
pub fn get_installation_settings_path() -> PathBuf {
    let base_dirs = BaseDirs::new()
        .ok_or_else(|| error!("Failed to determine base directories"))
        .unwrap();

    base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("fitgirlConfig")
        .join("settings")
        .join("installation")
        .join("installation.json")
}

#[tauri::command]
#[specta]
pub fn get_gamehub_settings_path() -> PathBuf {
    let base_dirs = BaseDirs::new()
        .ok_or_else(|| error!("Failed to determine base directories"))
        .unwrap();

    base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("fitgirlConfig")
        .join("settings")
        .join("gamehub")
        .join("gamehub.json")
}

#[tauri::command]
#[specta]
pub fn get_dns_settings_path() -> PathBuf {
    let base_dirs = BaseDirs::new()
        .ok_or_else(|| error!("Failed to determine base directories"))
        .unwrap();

    base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("fitgirlConfig")
        .join("settings")
        .join("dns")
        .join("dns.json")
}

#[tauri::command]
#[specta]
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
#[specta]
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
#[specta]
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
#[specta]
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
#[specta]
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

    fs::write(gamehub_file_path, settings_json_string).map_err(SettingsConfigurationError::from)?;
    Ok(())
}

#[tauri::command]
#[specta]
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
#[specta]
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

/// json_path: path to a json file, in the form like:
///
/// ```json
/// [
///     {
///         "name": "xxx",
///         "value": "xxx"
///     },
///     {
///         "name": "xxx",
///         "value": "xxx"
///     }
/// ]
/// ```
///
/// Extra fields are allowed.
///
/// Also, to make effect, an restart is required.
#[tauri::command]
#[specta]
pub async fn import_cookies_file(json_path: String) -> Result<(), String> {
    let json = tokio::fs::read_to_string(json_path)
        .await
        .map_err(|e| e.to_string())?;
    // validate cookies format
    let cookies: cookies::Cookies = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    import_cookies(cookies).await?;
    Ok(())
}

#[tauri::command]
#[specta]
pub async fn import_cookies(cookies: Cookies) -> Result<(), String> {
    tokio::fs::create_dir_all(cookies::Cookies::default_dir())
        .await
        .map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&cookies).map_err(|e| e.to_string())?;
    tokio::fs::write(cookies::Cookies::default_path(), &json)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta]
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
