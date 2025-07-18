use std::{
    net::{Ipv4Addr, SocketAddr, SocketAddrV4},
    path::PathBuf,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use specta::Type;

use crate::FitLauncherConfigAria2;

//
// 1. Legacy config (kept for migration only)
//
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug, Default)]
#[serde(default)]
pub struct LegacyFitLauncherConfig {
    pub default_download_location: PathBuf,

    pub dht: LegacyDht,
    pub tcp_listen: LegacyTcpListen,
    pub upnp: LegacyUpnp,
    pub persistence: LegacyPersistence,
    pub peer_opts: LegacyPeerOpts,
    http_api: LegacyHttpApi,

    pub aria2_rpc: FitLauncherConfigAria2,
}

// legacy sub‑structs
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug, Default)]
#[serde(default)]
pub struct LegacyDht {
    pub disable: bool,
    pub disable_persistence: bool,
    pub persistence_filename: PathBuf,
}

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Type, Debug, Default)]
#[serde(default)]
pub struct LegacyTcpListen {
    pub disable: bool,
    pub min_port: u16,
    pub max_port: u16,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug, Default)]
#[serde(default)]
pub struct LegacyUpnp {
    #[serde(rename = "disable")]
    pub disable_tcp_port_forward: bool,
    pub enable_server: bool,
    pub server_friendly_name: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug)]
#[serde(default)]
pub struct LegacyPersistence {
    pub disable: bool,
    pub folder: PathBuf,
    pub fastresume: bool,
    #[serde(default)]
    filename: PathBuf,
}

impl Default for LegacyPersistence {
    fn default() -> Self {
        Self {
            disable: false,
            folder: PathBuf::new(),
            fastresume: true,
            filename: PathBuf::new(),
        }
    }
}

#[serde_as]
#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Type, Debug, Default)]
#[serde(default)]
pub struct LegacyPeerOpts {
    pub connect_timeout: Duration,
    pub read_write_timeout: Duration,
}

#[serde_as]
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug)]
#[serde(default)]
pub struct LegacyHttpApi {
    pub disable: bool,
    pub listen_addr: SocketAddr,
    pub read_only: bool,
}

impl Default for LegacyHttpApi {
    fn default() -> Self {
        Self {
            disable: true,
            listen_addr: SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 3030)),
            read_only: false,
        }
    }
}
