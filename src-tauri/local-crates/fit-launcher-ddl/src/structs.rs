use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;

pub static FUCKINGFAST_DDL_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"window\.open\(\"(https://fuckingfast.co/dl/[^"]*)\"\)"#).unwrap());
pub static FUCKINGFAST_SIZE_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"Size:\s*([0-9\.]+)\s*([KMGTP]?B)"#).unwrap());

#[derive(Debug, Default, Clone, Serialize, Deserialize, Type)]
pub struct DirectLink {
    pub url: String,
    pub filename: String,
    /// size in bytes
    pub size: u64,
}
#[derive(Debug, Default, Type)]
pub struct GameInfoLinks {
    pub href: String,
    pub download_links: Vec<String>,
}
