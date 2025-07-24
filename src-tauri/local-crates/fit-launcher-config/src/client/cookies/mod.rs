use std::path::PathBuf;

use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;
use tracing::error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("io: {0}")]
    IO(#[from] std::io::Error),
    #[error("deser: {0}")]
    DeSer(#[from] serde_json::Error),
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Type)]
pub struct Cookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub expires: Option<String>, // Use RFC 1123/ISO 8601 date string
    pub max_age: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Type)]
pub struct Cookies(pub Vec<Cookie>);

impl Cookies {
    pub fn load_cookies() -> Result<Self, Error> {
        let path = Self::default_path();
        let raw: Vec<u8> = std::fs::read(path)?;
        Ok(serde_json::from_slice(&raw)?)
    }

    pub fn default_path() -> PathBuf {
        Self::default_dir().join("cookies.json")
    }

    pub fn default_dir() -> PathBuf {
        BaseDirs::new()
            .expect("Failed to determine base directories")
            .config_dir()
            .join("com.fitlauncher.carrotrub")
            .join("fitgirlConfig")
            .join("settings")
            .join("cookies")
    }

    pub fn to_header(&self) -> String {
        self.0
            .iter()
            .map(|Cookie { name, value, .. }| format!("{name}={value}"))
            .collect::<Vec<String>>()
            .join(";")
    }

    pub fn save_local(cookies: &Vec<Cookie>) -> Result<(), Error> {
        let path = Self::default_path();
        let json = serde_json::to_string_pretty(&cookies)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn save(&self) -> Result<(), Error> {
        let path = Self::default_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, serde_json::to_vec(self)?)?;
        Ok(())
    }
}
