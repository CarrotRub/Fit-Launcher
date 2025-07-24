use serde::Serialize;
use specta::Type;
use std::fmt;



#[derive(Debug, Serialize, Type)]
pub struct SettingsConfigurationError {
    pub message: String,
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
