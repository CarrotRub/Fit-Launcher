use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

#[derive(Debug, Error, Deserialize, Type)]
pub enum Aria2Error {
    #[error("ws-jsonrpc not configured properly!")]
    NotConfigured,

    #[error("RPC error: {0}")]
    RPCError(String),
}

impl From<aria2_ws::Error> for Aria2Error {
    fn from(err: aria2_ws::Error) -> Self {
        Aria2Error::RPCError(err.to_string())
    }
}

impl From<String> for Aria2Error {
    fn from(s: String) -> Self {
        Aria2Error::RPCError(s)
    }
}

impl From<&str> for Aria2Error {
    fn from(s: &str) -> Self {
        Aria2Error::RPCError(s.to_owned())
    }
}

impl Serialize for Aria2Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
