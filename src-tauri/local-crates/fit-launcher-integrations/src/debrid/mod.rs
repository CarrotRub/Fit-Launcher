//! Debrid service integrations. All providers return unified types.

pub mod commands;
pub mod realdebrid;
pub mod torbox;
pub mod types;

pub use types::*;
pub use commands::*;
pub use realdebrid::RealDebridClient;
pub use torbox::TorBoxClient;
