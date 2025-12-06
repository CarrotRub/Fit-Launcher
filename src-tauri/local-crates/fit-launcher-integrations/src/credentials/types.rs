//! Credential storage types.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::debrid::DebridProvider;

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
    #[error("Stronghold not initialized - call credentials_init first")]
    NotInitialized,

    #[error("Failed to access stronghold: {0}")]
    StrongholdError(String),

    #[error("Credential not found for provider")]
    NotFound,

    #[error("Invalid credential format")]
    InvalidFormat,

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Failed to acquire lock: {0}")]
    LockError(String),
}
