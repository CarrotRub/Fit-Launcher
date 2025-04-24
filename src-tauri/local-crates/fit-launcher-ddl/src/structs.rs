use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

pub static FUCKINGFAST_DDL_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"window\.open\(\"(https://fuckingfast.co/dl/[^"]*)\"\)"#).unwrap());

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct DirectLink {
    pub url: String,
    pub filename: String,
}
#[derive(Debug, Default)]
pub struct GameInfoLinks {
    pub href: String,
    pub download_links: Vec<String>,
}
