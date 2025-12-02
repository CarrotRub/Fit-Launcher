//! Tauri commands for credential management.
//! Call `credentials_init` first, then use other commands.

use super::store::CredentialStore;
use super::types::{CredentialError, CredentialInfo, CredentialStatus};
use crate::debrid::DebridProvider;
use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString},
};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_stronghold::stronghold::Stronghold;
use zeroize::Zeroize;

pub struct ManagedStronghold(pub Mutex<Option<Stronghold>>);

fn derive_machine_password(app: &AppHandle, user_salt: &[u8]) -> Result<Vec<u8>, CredentialError> {
    let mut input_material = user_salt.to_vec();

    if let Ok(app_data) = app.path().app_data_dir() {
        input_material.extend_from_slice(app_data.to_string_lossy().as_bytes());
    }
    if let Ok(local_data) = app.path().app_local_data_dir() {
        input_material.extend_from_slice(local_data.to_string_lossy().as_bytes());
    }
    if let Ok(home) = app.path().home_dir() {
        input_material.extend_from_slice(home.to_string_lossy().as_bytes());
    }

    let salt = SaltString::encode_b64(b"fit-launcher-secure-salt")
        .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;

    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(&input_material, &salt)
        .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;
    input_material.zeroize();

    let hash_bytes = password_hash
        .hash
        .ok_or_else(|| CredentialError::StrongholdError("No hash output".to_string()))?;

    Ok(hash_bytes.as_bytes().to_vec())
}

#[tauri::command]
#[specta::specta]
pub fn credentials_init(
    app: AppHandle,
    state: State<'_, ManagedStronghold>,
    mut password: Vec<u8>,
) -> Result<(), CredentialError> {
    let mut derived_password = derive_machine_password(&app, &password)?;
    let stronghold = CredentialStore::create_stronghold(&app, &derived_password)?;

    password.zeroize();
    derived_password.zeroize();

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
    mut api_key: Vec<u8>,
) -> Result<(), CredentialError> {
    let guard = state
        .0
        .lock()
        .map_err(|e| CredentialError::LockError(e.to_string()))?;
    let stronghold = guard.as_ref().ok_or(CredentialError::NotInitialized)?;
    let result = CredentialStore::store_api_key(stronghold, provider, &api_key);
    api_key.zeroize();

    result
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
