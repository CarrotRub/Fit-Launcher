//! FitLauncher Installer Controller
//!
//! A short-lived elevated process that handles privileged installer operations:
//! - Launching setup.exe with admin rights
//! - Installing SetWinEventHook for progress monitoring
//! - Running UI automation (clicking dialogs, setting paths)
//! - Reporting progress back to the main GUI via IPC
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────┐
//! │  Tauri GUI (non-elevated)                                       │
//! │  ┌─────────────────────────────────────────────────────────┐    │
//! │  │  IpcClient::connect() ──► spawn installer-controller.exe│    │
//! │  │  IpcClient::start_install(...)                          │    │
//! │  │  loop { IpcClient::recv() => emit tauri events }        │    │
//! │  └─────────────────────────────────────────────────────────┘    │
//! └──────────────────────────────────────────────────────────────────┘
//!                              ▲
//!                              │ Named Pipe IPC
//!                              ▼
//! ┌──────────────────────────────────────────────────────────────────┐
//! │  Installer Controller (elevated, this process)                   │
//! │  ┌─────────────────────────────────────────────────────────┐    │
//! │  │  IpcServer::run()                                       │    │
//! │  │  ├─► receive StartInstall command                       │    │
//! │  │  ├─► spawn setup.exe                                    │    │
//! │  │  ├─► run UI automation                                  │    │
//! │  │  ├─► SetWinEventHook for progress                       │    │
//! │  │  └─► send Progress/Phase/Completed events               │    │
//! │  └─────────────────────────────────────────────────────────┘    │
//! └──────────────────────────────────────────────────────────────────┘
//! ```

pub mod automation;
pub mod defender;
pub mod events;
pub mod installer;
pub mod ipc;

use std::env;
use tracing::{Level, error, info};
use tracing_subscriber::FmtSubscriber;

use crate::ipc::server::IpcServer;

fn main() {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::DEBUG)
        .with_target(true)
        .with_thread_ids(true)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("Failed to set tracing subscriber");

    info!("Installer Controller starting...");

    // Parse command line arguments
    let args: Vec<String> = env::args().collect();

    // Expected: installer-controller.exe <pipe_name>
    let pipe_name = args.get(1).cloned().unwrap_or_else(|| {
        // Default pipe name for testing
        r"\\.\pipe\fit-launcher-automation".to_string()
    });

    info!("Using pipe: {}", pipe_name);

    // Run the IPC server
    if let Err(e) = run_server(&pipe_name) {
        error!("Controller failed: {:#}", e);
        std::process::exit(1);
    }

    info!("Installer Controller shutting down");
}

fn run_server(pipe_name: &str) -> anyhow::Result<()> {
    let mut server = IpcServer::new(pipe_name)?;
    server.run()
}
