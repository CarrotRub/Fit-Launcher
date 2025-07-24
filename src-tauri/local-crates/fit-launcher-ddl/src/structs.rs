use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;

pub static FUCKINGFAST_DDL_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"window\.open\(\"(https://fuckingfast.co/dl/[^"]*)\"\)"#).unwrap());

#[derive(Debug, Default, Serialize, Deserialize, Type)]
pub struct DirectLink {
    pub url: String,
    pub filename: String,
}
#[derive(Debug, Default, Type)]
pub struct GameInfoLinks {
    pub href: String,
    pub download_links: Vec<String>,
}
