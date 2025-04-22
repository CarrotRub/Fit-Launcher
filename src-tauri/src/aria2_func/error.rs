use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Aria2Error {
    #[error("ws-jsonrpc not configured properly!")]
    NotConfigured,
    #[error("RPC error: {0}")]
    RPCError(#[from] aria2_ws::Error),
}

impl Serialize for Aria2Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
