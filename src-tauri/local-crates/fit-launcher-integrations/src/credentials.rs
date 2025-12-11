//! Windows uses WinCred
//! Linux uses both keyutils and secret service
//! macOS uses Keychain

use crate::debrid::DebridProvider;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use specta::Type;
use tracing::info;

const SERVICE_NAME: &str = "fit-launcher";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CredentialStatus {
    pub provider: DebridProvider,
    pub has_credential: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CredentialInfo {
    pub configured_providers: Vec<DebridProvider>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, thiserror::Error)]
pub enum CredentialError {
    #[error("Keyring error: {0}")]
    KeyringError(String),

    #[error("Credential not found")]
    NotFound,
}

fn entry_for(provider: DebridProvider) -> Result<Entry, CredentialError> {
    let key = format!("debrid-{}", provider.to_string().to_lowercase());
    Entry::new(SERVICE_NAME, &key).map_err(|e| CredentialError::KeyringError(e.to_string()))
}

pub fn store(provider: DebridProvider, api_key: &str) -> Result<(), CredentialError> {
    entry_for(provider)?
        .set_password(api_key)
        .map_err(|e| CredentialError::KeyringError(e.to_string()))?;
    info!("Stored API key for {:?}", provider);
    Ok(())
}

pub fn get(provider: DebridProvider) -> Result<String, CredentialError> {
    entry_for(provider)?.get_password().map_err(|e| match e {
        keyring::Error::NoEntry => CredentialError::NotFound,
        _ => CredentialError::KeyringError(e.to_string()),
    })
}

pub fn exists(provider: DebridProvider) -> bool {
    get(provider).is_ok()
}

pub fn remove(provider: DebridProvider) -> Result<(), CredentialError> {
    entry_for(provider)?
        .delete_credential()
        .map_err(|e| CredentialError::KeyringError(e.to_string()))?;
    info!("Removed API key for {:?}", provider);
    Ok(())
}

pub fn list_configured() -> Vec<DebridProvider> {
    DebridProvider::all()
        .into_iter()
        .filter(|p| exists(*p))
        .collect()
}

#[tauri::command]
#[specta::specta]
pub fn credentials_store(provider: DebridProvider, api_key: String) -> Result<(), CredentialError> {
    store(provider, &api_key)
}

#[tauri::command]
#[specta::specta]
pub fn credentials_get(provider: DebridProvider) -> Result<String, CredentialError> {
    get(provider)
}

#[tauri::command]
#[specta::specta]
pub fn credentials_exists(provider: DebridProvider) -> Result<bool, CredentialError> {
    Ok(exists(provider))
}

#[tauri::command]
#[specta::specta]
pub fn credentials_remove(provider: DebridProvider) -> Result<(), CredentialError> {
    remove(provider)
}

#[tauri::command]
#[specta::specta]
pub fn credentials_status(provider: DebridProvider) -> Result<CredentialStatus, CredentialError> {
    Ok(CredentialStatus {
        provider,
        has_credential: exists(provider),
    })
}

#[tauri::command]
#[specta::specta]
pub fn credentials_list() -> Result<CredentialInfo, CredentialError> {
    Ok(CredentialInfo {
        configured_providers: list_configured(),
    })
}
