use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, thiserror::Error, Serialize, Deserialize)]
pub enum ScrapingError {
    #[error("Request Error: {0}")]
    #[serde(skip)]
    ReqwestError(#[from] reqwest::Error),

    #[error("Selector Parsing Error: {0}")]
    SelectorError(String),

    #[error("Modifying JSON Error: {0}")]
    #[serde(skip)]
    FileJSONError(#[from] serde_json::Error),

    #[error("Creating File Error in `{fn_name}`: {source}")]
    #[serde(skip)]
    CreatingFileError {
        source: std::io::Error,
        fn_name: String,
    },
    #[error("Global Error: {0}")]
    #[serde(skip)]
    GlobalError(String),
}

#[derive(Debug, Serialize)]
pub struct SingularFetchError {
    message: String,
}

impl fmt::Display for SingularFetchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for SingularFetchError {}

impl From<reqwest::Error> for SingularFetchError {
    fn from(error: reqwest::Error) -> Self {
        SingularFetchError {
            message: error.to_string(),
        }
    }
}

impl From<std::io::Error> for SingularFetchError {
    fn from(error: std::io::Error) -> Self {
        SingularFetchError {
            message: error.to_string(),
        }
    }
}

impl From<serde_json::Error> for SingularFetchError {
    fn from(error: serde_json::Error) -> Self {
        SingularFetchError {
            message: error.to_string(),
        }
    }
}
