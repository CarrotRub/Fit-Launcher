use serde::{Deserialize, Serialize};
use specta::Type;
use std::fmt;

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreatingFileErrorStruct {
    pub source: String,
    pub fn_name: String,
}

impl fmt::Display for CreatingFileErrorStruct {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "function `{}` failed to create file: {}",
            self.fn_name, self.source
        )
    }
}

#[derive(Debug, thiserror::Error, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "type", content = "data")]
pub enum ScrapingError {
    #[error("Failed to extract article")]
    ArticleNotFound(String),

    #[error("Request Error: {0}")]
    ReqwestError(String),

    #[error("Selector Parsing Error: {0}")]
    SelectorError(String),

    #[error("Modifying JSON Error: {0}")]
    FileJSONError(String),

    #[error("Creating File Error: {0}")]
    CreatingFileError(CreatingFileErrorStruct),

    #[error("Global Error: {0}")]
    GlobalError(String),

    #[error("Http Request Error: {0}")]
    HttpStatusCodeError(String),

    #[error("Timeout Error: {0}")]
    TimeoutError(String),

    #[error("I/O Error: {0}")]
    IOError(String),

    #[error("Window Error: {0}")]
    WindowError(String),

    #[error("Cookie Error: {0}")]
    CookieError(String),

    #[error("URL parse error: {0}")]
    UrlParseError(String),
}

impl From<reqwest::Error> for ScrapingError {
    fn from(error: reqwest::Error) -> Self {
        ScrapingError::ReqwestError(error.to_string())
    }
}

impl From<serde_json::Error> for ScrapingError {
    fn from(error: serde_json::Error) -> Self {
        ScrapingError::FileJSONError(error.to_string())
    }
}
impl From<std::io::Error> for ScrapingError {
    fn from(error: std::io::Error) -> Self {
        ScrapingError::IOError(error.to_string())
    }
}
