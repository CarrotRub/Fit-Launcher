//! Stronghold-based encrypted storage for API keys.

use super::types::{CredentialError, CredentialInfo, CredentialStatus};
use crate::debrid::DebridProvider;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_stronghold::stronghold::Stronghold;
use tracing::{debug, info};
use zeroize::Zeroize;

const VAULT_FILENAME: &str = "credentials.hold";
const CLIENT_NAME: &[u8] = b"debrid_credentials";

fn provider_key(provider: DebridProvider) -> Vec<u8> {
    format!("api_key_{}", provider.to_string().to_lowercase()).into_bytes()
}

pub struct CredentialStore;

impl CredentialStore {
    pub fn vault_path(app: &AppHandle) -> Result<PathBuf, CredentialError> {
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| CredentialError::IoError(e.to_string()))?;

        // Ensure directory exists
        std::fs::create_dir_all(&app_data).map_err(|e| CredentialError::IoError(e.to_string()))?;

        Ok(app_data.join(VAULT_FILENAME))
    }

    pub fn create_stronghold(
        app: &AppHandle,
        password: &[u8],
    ) -> Result<Stronghold, CredentialError> {
        let vault_path = Self::vault_path(app)?;

        // Password is already a 32-byte key from Argon2
        let mut key = password.to_vec();

        debug!("Initializing stronghold at {:?}", vault_path);

        let result = match Stronghold::new(&vault_path, key.clone()) {
            Ok(stronghold) => Ok(stronghold),
            Err(e) => {
                let error_str = e.to_string();
                // Check for known corruption errors
                if error_str.contains("non-contiguous")
                    || error_str.contains("corrupted")
                    || error_str.contains("invalid")
                {
                    // Vault file is corrupted, try to delete and recreate
                    tracing::warn!(
                        "Stronghold vault appears corrupted ({}), attempting recovery by deleting {:?}",
                        error_str,
                        vault_path
                    );

                    if vault_path.exists() {
                        if let Err(delete_err) = std::fs::remove_file(&vault_path) {
                            tracing::error!(
                                "Failed to delete corrupted vault file: {}",
                                delete_err
                            );
                            return Err(CredentialError::StrongholdError(format!(
                                "Vault corrupted and could not be deleted: {}. Please manually delete: {:?}",
                                delete_err, vault_path
                            )));
                        }
                        tracing::info!("Deleted corrupted vault file, creating new one");
                    }

                    // Try again with a fresh vault
                    Stronghold::new(&vault_path, key.clone())
                        .map_err(|e2| CredentialError::StrongholdError(e2.to_string()))
                } else {
                    Err(CredentialError::StrongholdError(error_str))
                }
            }
        };

        key.zeroize();
        result
    }

    pub fn store_api_key(
        stronghold: &Stronghold,
        provider: DebridProvider,
        api_key: &[u8],
    ) -> Result<(), CredentialError> {
        let client = stronghold
            .load_client(CLIENT_NAME)
            .or_else(|_| stronghold.get_client(CLIENT_NAME))
            .or_else(|_| stronghold.create_client(CLIENT_NAME))
            .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;

        let store = client.store();
        let key = provider_key(provider);
        store
            .insert(key, api_key.to_vec(), None)
            .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;

        stronghold
            .write_client(CLIENT_NAME)
            .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;
        stronghold
            .save()
            .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;

        info!("Stored API key for {:?}", provider);
        Ok(())
    }

    pub fn get_api_key(
        stronghold: &Stronghold,
        provider: DebridProvider,
    ) -> Result<String, CredentialError> {
        let client = stronghold
            .load_client(CLIENT_NAME)
            .or_else(|_| stronghold.get_client(CLIENT_NAME))
            .map_err(|_| CredentialError::NotFound)?;

        let store = client.store();
        let key = provider_key(provider);
        let data = store
            .get(&key)
            .map_err(|_| CredentialError::NotFound)?
            .ok_or(CredentialError::NotFound)?;

        String::from_utf8(data).map_err(|_| CredentialError::InvalidFormat)
    }

    pub fn has_credential(stronghold: &Stronghold, provider: DebridProvider) -> bool {
        Self::get_api_key(stronghold, provider).is_ok()
    }

    pub fn remove_api_key(
        stronghold: &Stronghold,
        provider: DebridProvider,
    ) -> Result<(), CredentialError> {
        let client = stronghold
            .load_client(CLIENT_NAME)
            .or_else(|_| stronghold.get_client(CLIENT_NAME))
            .map_err(|_| CredentialError::NotFound)?;

        let store = client.store();
        let key = provider_key(provider);
        store
            .delete(&key)
            .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;

        stronghold
            .write_client(CLIENT_NAME)
            .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;
        stronghold
            .save()
            .map_err(|e| CredentialError::StrongholdError(e.to_string()))?;

        info!("Removed API key for {:?}", provider);
        Ok(())
    }

    pub fn get_status(stronghold: &Stronghold, provider: DebridProvider) -> CredentialStatus {
        CredentialStatus {
            provider,
            has_credential: Self::has_credential(stronghold, provider),
        }
    }

    pub fn get_info(stronghold: &Stronghold) -> CredentialInfo {
        let mut configured_providers = Vec::new();
        for provider in [
            DebridProvider::TorBox,
            DebridProvider::RealDebrid,
            DebridProvider::AllDebrid,
        ] {
            if Self::has_credential(stronghold, provider) {
                configured_providers.push(provider);
            }
        }

        CredentialInfo {
            configured_providers,
        }
    }
}
