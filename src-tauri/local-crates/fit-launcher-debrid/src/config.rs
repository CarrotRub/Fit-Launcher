use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tracing::{debug, error};

use crate::DebridError;

const STORE_FILE: &str = "debrid_config.json";

/// Stored credentials for a debrid provider
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct StoredCredentials {
    /// Provider ID
    pub provider_id: String,
    /// Encoded API key (base64 for basic obfuscation)
    pub api_key_encoded: String,
    /// Whether this provider is enabled
    pub enabled: bool,
}

/// Debrid settings storage
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct DebridStoredSettings {
    /// Default provider to use
    pub default_provider: Option<String>,
    /// Whether to auto-fallback to torrent on debrid failure
    pub auto_fallback: bool,
}

/// All stored debrid data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct DebridStoreData {
    credentials: Vec<StoredCredentials>,
    settings: DebridStoredSettings,
}

/// Encode API key for storage (basic obfuscation, not encryption)
fn encode_api_key(key: &str) -> String {
    use std::io::Write;
    let mut encoder = base64::write::EncoderStringWriter::new(&base64::engine::general_purpose::STANDARD);
    encoder.write_all(key.as_bytes()).unwrap();
    encoder.into_inner()
}

/// Decode API key from storage
fn decode_api_key(encoded: &str) -> Result<String, DebridError> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| DebridError::InternalError(format!("Failed to decode API key: {}", e)))?;
    String::from_utf8(bytes)
        .map_err(|e| DebridError::InternalError(format!("Invalid UTF-8 in API key: {}", e)))
}

/// Get the store file path
fn get_store_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(STORE_FILE)
}

/// Load store data from file
fn load_store_data(app: &AppHandle) -> DebridStoreData {
    let path = get_store_path(app);
    if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str(&contents) {
                Ok(data) => return data,
                Err(e) => error!("Failed to parse debrid config: {}", e),
            },
            Err(e) => error!("Failed to read debrid config: {}", e),
        }
    }
    DebridStoreData::default()
}

/// Save store data to file
fn save_store_data(app: &AppHandle, data: &DebridStoreData) -> Result<(), DebridError> {
    let path = get_store_path(app);
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| DebridError::InternalError(format!("Failed to create config dir: {}", e)))?;
    }
    
    let contents = serde_json::to_string_pretty(data)
        .map_err(|e| DebridError::InternalError(format!("Failed to serialize config: {}", e)))?;
    
    std::fs::write(&path, contents)
        .map_err(|e| DebridError::InternalError(format!("Failed to write config: {}", e)))?;
    
    debug!("Saved debrid config to {:?}", path);
    Ok(())
}

// ============================================================================
// Tauri Commands for Credentials Management
// ============================================================================

/// Save credentials for a provider
#[tauri::command]
#[specta::specta]
pub async fn debrid_save_credentials(
    app: AppHandle,
    provider_id: String,
    api_key: String,
    enabled: bool,
) -> Result<(), DebridError> {
    let mut data = load_store_data(&app);
    
    // Encode the API key
    let encoded_key = encode_api_key(&api_key);
    
    // Find and update or add new credentials
    if let Some(cred) = data.credentials.iter_mut().find(|c| c.provider_id == provider_id) {
        cred.api_key_encoded = encoded_key;
        cred.enabled = enabled;
    } else {
        data.credentials.push(StoredCredentials {
            provider_id,
            api_key_encoded: encoded_key,
            enabled,
        });
    }
    
    save_store_data(&app, &data)
}

/// Get credentials for a provider
#[tauri::command]
#[specta::specta]
pub async fn debrid_get_credentials(
    app: AppHandle,
    provider_id: String,
) -> Result<Option<StoredCredentials>, DebridError> {
    let data = load_store_data(&app);
    Ok(data.credentials.into_iter().find(|c| c.provider_id == provider_id))
}

/// Get the decoded API key for a provider
#[tauri::command]
#[specta::specta]
pub async fn debrid_get_api_key(
    app: AppHandle,
    provider_id: String,
) -> Result<Option<String>, DebridError> {
    let data = load_store_data(&app);
    if let Some(cred) = data.credentials.iter().find(|c| c.provider_id == provider_id) {
        let decoded = decode_api_key(&cred.api_key_encoded)?;
        Ok(Some(decoded))
    } else {
        Ok(None)
    }
}

/// List all configured providers (those with saved credentials)
#[tauri::command]
#[specta::specta]
pub async fn debrid_list_configured_providers(
    app: AppHandle,
) -> Result<Vec<StoredCredentials>, DebridError> {
    let data = load_store_data(&app);
    // Return credentials but with encoded keys (not decoded for security)
    Ok(data.credentials)
}

/// Remove credentials for a provider
#[tauri::command]
#[specta::specta]
pub async fn debrid_remove_credentials(
    app: AppHandle,
    provider_id: String,
) -> Result<(), DebridError> {
    let mut data = load_store_data(&app);
    data.credentials.retain(|c| c.provider_id != provider_id);
    save_store_data(&app, &data)
}

/// Get debrid settings
#[tauri::command]
#[specta::specta]
pub async fn debrid_get_settings(
    app: AppHandle,
) -> Result<DebridStoredSettings, DebridError> {
    let data = load_store_data(&app);
    Ok(data.settings)
}

/// Save debrid settings
#[tauri::command]
#[specta::specta]
pub async fn debrid_save_settings(
    app: AppHandle,
    settings: DebridStoredSettings,
) -> Result<(), DebridError> {
    let mut data = load_store_data(&app);
    data.settings = settings;
    save_store_data(&app, &data)
}

/// Set the default provider
#[tauri::command]
#[specta::specta]
pub async fn debrid_set_default_provider(
    app: AppHandle,
    provider_id: Option<String>,
) -> Result<(), DebridError> {
    let mut data = load_store_data(&app);
    data.settings.default_provider = provider_id;
    save_store_data(&app, &data)
}

/// Check if any provider is configured and enabled
#[tauri::command]
#[specta::specta]
pub async fn debrid_has_configured_provider(
    app: AppHandle,
) -> Result<bool, DebridError> {
    let data = load_store_data(&app);
    Ok(data.credentials.iter().any(|c| c.enabled))
}

