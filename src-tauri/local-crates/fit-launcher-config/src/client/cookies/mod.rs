use std::path::PathBuf;

use directories::BaseDirs;
use reqwest::Response;
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

    /// Parse a raw `Set-Cookie` header value and upsert it into the cookie list.
    ///
    /// **Example** :
    ///
    ///    - `__ddg1_=abc123; Path=/; Domain=fitgirl-repacks.site; Max-Age=31536000`
    pub fn merge_from_set_cookie(&mut self, set_cookie: &str) {
        let mut parts = set_cookie.split(';').map(str::trim);

        let Some(name_value) = parts.next() else {
            return;
        };
        let Some((name, value)) = name_value.split_once('=') else {
            return;
        };

        let name = name.trim().to_string();
        let value = value.trim().to_string();

        let mut domain: Option<String> = None;
        let mut path: Option<String> = None;
        let mut expires: Option<String> = None;
        let mut max_age: Option<i64> = None;

        for attr in parts {
            if let Some((k, v)) = attr.split_once('=') {
                match k.trim().to_lowercase().as_str() {
                    "domain" => domain = Some(v.trim().to_string()),
                    "path" => path = Some(v.trim().to_string()),
                    "expires" => expires = Some(v.trim().to_string()),
                    "max-age" => max_age = v.trim().parse().ok(),
                    _ => {}
                }
            }
        }

        let new_cookie = Cookie {
            name: name.clone(),
            value,
            domain,
            path,
            expires,
            max_age,
        };

        // big bad blob: replace existing cookie with the same name, or push
        match self.0.iter_mut().find(|c| c.name == name) {
            Some(existing) => *existing = new_cookie,
            None => self.0.push(new_cookie),
        }
    }

    pub fn save(&self) -> Result<(), Error> {
        let path = Self::default_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, serde_json::to_vec_pretty(self)?)?;
        Ok(())
    }
}

/// Extract any Set-Cookie headers from a response, merge them into the
/// on-disk cookie store, and save.
///
/// Please **Call** this after every response that might carry DDoS-Guard / challenge cookies.
///
/// This will be very useful to avoid long waiting times, especially when using a VPN.
pub fn persist_response_cookies(response: &Response) {
    let set_cookie_values: Vec<String> = response
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok().map(String::from))
        .collect();

    if set_cookie_values.is_empty() {
        return;
    }

    let mut cookies = Cookies::load_cookies().unwrap_or_else(|_| Cookies(vec![]));

    for raw in &set_cookie_values {
        println!("Merging Set-Cookie: {}", raw);
        cookies.merge_from_set_cookie(raw);
    }

    if let Err(e) = cookies.save() {
        error!("Failed to persist cookies to disk: {}", e);
    }
}
