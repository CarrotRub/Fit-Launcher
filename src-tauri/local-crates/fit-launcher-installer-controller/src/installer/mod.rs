//! Installer runner that orchestrates the installation process.
//!
//! Handles:
//! - Spawning setup.exe with appropriate arguments
//! - Running UI automation
//! - Monitoring progress via WinEventHook
//! - Tracking process lifecycle

mod runner;

pub use runner::InstallerRunner;
