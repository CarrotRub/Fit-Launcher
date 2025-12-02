//! Tauri commands for credential management.
//! Call `credentials_init` first, then use other commands.

use super::store::CredentialStore;
use super::types::{CredentialError, CredentialInfo, CredentialStatus};
use crate::debrid::DebridProvider;
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_stronghold::stronghold::Stronghold;

pub struct ManagedStronghold(pub Mutex<Option<Stronghold>>);

fn derive_machine_password(app: &AppHandle, user_salt: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(user_salt.as_bytes());

    if let Ok(app_data) = app.path().app_data_dir() {
        hasher.update(app_data.to_string_lossy().as_bytes());
    }
    if let Ok(local_data) = app.path().app_local_data_dir() {
        hasher.update(local_data.to_string_lossy().as_bytes());
    }
    if let Ok(home) = app.path().home_dir() {
        hasher.update(home.to_string_lossy().as_bytes());
    }
    hasher.finalize().to_vec()
}

#[tauri::command]
#[specta::specta]
pub fn credentials_init(
    app: AppHandle,
    state: State<'_, ManagedStronghold>,
    password: String,
) -> Result<(), CredentialError> {
    let derived_password = derive_machine_password(&app, &password);
    let stronghold = CredentialStore::create_stronghold(&app, &derived_password)?;
    let mut guard = state
        .0
        .lock()
        .map_err(|e| CredentialError::LockError(e.to_string()))?;
    *guard = Some(stronghold);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn credentials_store(
    state: State<'_, ManagedStronghold>,
    provider: DebridProvider,
    api_key: String,
) -> Result<(), CredentialError> {
    let guard = state
        .0
        .lock()
        .map_err(|e| CredentialError::LockError(e.to_string()))?;
    let stronghold = guard.as_ref().ok_or(CredentialError::NotInitialized)?;
    CredentialStore::store_api_key(stronghold, provider, &api_key)
}

#[tauri::command]
#[specta::specta]
pub fn credentials_get(
    state: State<'_, ManagedStronghold>,
    provider: DebridProvider,
) -> Result<String, CredentialError> {
    let guard = state
        .0
        .lock()
        .map_err(|e| CredentialError::LockError(e.to_string()))?;
    let stronghold = guard.as_ref().ok_or(CredentialError::NotInitialized)?;
    CredentialStore::get_api_key(stronghold, provider)
}

#[tauri::command]
#[specta::specta]
pub fn credentials_exists(
    state: State<'_, ManagedStronghold>,
    provider: DebridProvider,
) -> Result<bool, CredentialError> {
    let guard = state
        .0
        .lock()
        .map_err(|e| CredentialError::LockError(e.to_string()))?;
    let stronghold = guard.as_ref().ok_or(CredentialError::NotInitialized)?;
    Ok(CredentialStore::has_credential(stronghold, provider))
}

#[tauri::command]
#[specta::specta]
pub fn credentials_remove(
    state: State<'_, ManagedStronghold>,
    provider: DebridProvider,
) -> Result<(), CredentialError> {
    let guard = state
        .0
        .lock()
        .map_err(|e| CredentialError::LockError(e.to_string()))?;
    let stronghold = guard.as_ref().ok_or(CredentialError::NotInitialized)?;
    CredentialStore::remove_api_key(stronghold, provider)
}

#[tauri::command]
#[specta::specta]
pub fn credentials_status(
    state: State<'_, ManagedStronghold>,
    provider: DebridProvider,
) -> Result<CredentialStatus, CredentialError> {
    let guard = state
        .0
        .lock()
        .map_err(|e| CredentialError::LockError(e.to_string()))?;
    let stronghold = guard.as_ref().ok_or(CredentialError::NotInitialized)?;
    Ok(CredentialStore::get_status(stronghold, provider))
}

#[tauri::command]
#[specta::specta]
pub fn credentials_list(
    state: State<'_, ManagedStronghold>,
) -> Result<CredentialInfo, CredentialError> {
    let guard = state
        .0
        .lock()
        .map_err(|e| CredentialError::LockError(e.to_string()))?;
    let stronghold = guard.as_ref().ok_or(CredentialError::NotInitialized)?;
    Ok(CredentialStore::get_info(stronghold))
}
