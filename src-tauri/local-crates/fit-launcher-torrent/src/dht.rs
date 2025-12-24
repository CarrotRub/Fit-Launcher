use std::{
    fs,
    net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket},
    path::PathBuf,
};

use directories::BaseDirs;
use librqbit_dht::DhtConfig;
use serde::Serialize;
use thiserror::Error;

#[derive(Serialize)]
struct DhtConfigFile {
    listen_addr: Option<SocketAddr>,
    bootstrap_addrs: Option<Vec<String>>,
    peer_id: Option<String>,
}

impl From<&DhtConfig> for DhtConfigFile {
    fn from(cfg: &DhtConfig) -> Self {
        Self {
            listen_addr: cfg.listen_addr,
            bootstrap_addrs: cfg.bootstrap_addrs.clone(),
            peer_id: cfg.peer_id.as_ref().map(|id| id.as_string()),
        }
    }
}

#[derive(Debug, Error)]
pub enum DhtConfigError {
    #[error("Could not determine base directories")]
    BaseDirsUnavailable,

    #[error("Failed to create config directory at {path}: {source}")]
    CreateDir {
        path: PathBuf,
        source: std::io::Error,
    },

    #[error("Failed to bind UDP socket")]
    UdpBind(#[source] std::io::Error),

    #[error("Failed to serialize DHT config")]
    Serialize(#[source] serde_json::Error),

    #[error("Failed to write DHT config file at {path}")]
    WriteFile {
        path: PathBuf,
        source: std::io::Error,
    },
}

/// Keeps the UDP port alive for the lifetime of the DHT
pub struct DhtRuntime {
    pub config_path: PathBuf,
    pub udp_socket: UdpSocket,
}

pub(crate) fn dht_config_with_udp() -> Result<DhtRuntime, DhtConfigError> {
    let base_dirs = BaseDirs::new().ok_or(DhtConfigError::BaseDirsUnavailable)?;

    let config_dir = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("torrentConfig");

    fs::create_dir_all(&config_dir).map_err(|e| DhtConfigError::CreateDir {
        path: config_dir.clone(),
        source: e,
    })?;

    let udp_socket = UdpSocket::bind(("0.0.0.0", 0)).map_err(DhtConfigError::UdpBind)?;

    let port = udp_socket.local_addr().unwrap().port();

    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), port);
    let dhtconfig = DhtConfig {
        listen_addr: Some(addr),
        ..Default::default()
    };

    let path = config_dir.join("dhtConfig.json");
    let tmp_path = path.with_extension("json.tmp");

    let file_cfg = DhtConfigFile::from(&dhtconfig);
    let json = serde_json::to_string_pretty(&file_cfg).map_err(DhtConfigError::Serialize)?;

    fs::write(&tmp_path, json).map_err(|e| DhtConfigError::WriteFile {
        path: tmp_path.clone(),
        source: e,
    })?;

    fs::rename(&tmp_path, &path).map_err(|e| DhtConfigError::WriteFile {
        path: path.clone(),
        source: e,
    })?;

    Ok(DhtRuntime {
        config_path: path,
        udp_socket,
    })
}
