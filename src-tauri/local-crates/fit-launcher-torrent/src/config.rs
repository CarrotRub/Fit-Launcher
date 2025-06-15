use std::{
    net::{Ipv4Addr, SocketAddr, SocketAddrV4},
    path::{Path, PathBuf},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use specta::Type;

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(default)]
pub struct FitLauncherConfigDht {
    pub disable: bool,
    pub disable_persistence: bool,
    pub persistence_filename: PathBuf,
}

impl Default for FitLauncherConfigDht {
    fn default() -> Self {
        let persistnce_dht_path = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_local_dir() // Points to AppData\Local (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub")
            .join("torrentConfig")
            .join("dht")
            .join("cache")
            .join("dht.json");
        Self {
            disable: false,
            disable_persistence: false,
            persistence_filename: persistnce_dht_path,
        }
    }
}

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(default)]
pub struct FitLauncherConfigTcpListen {
    pub disable: bool,
    pub min_port: u16,
    pub max_port: u16,
}

impl Default for FitLauncherConfigTcpListen {
    fn default() -> Self {
        Self {
            disable: false,
            min_port: 4240,
            max_port: 4260,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(default)]
pub struct FitLauncherConfigPersistence {
    pub disable: bool,

    #[serde(default)]
    pub folder: PathBuf,

    #[serde(default)]
    pub fastresume: bool,

    /// Deprecated, but keeping for backwards compat for serialized / deserialized config.
    #[serde(default)]
    filename: PathBuf,
}

impl FitLauncherConfigPersistence {
    pub(crate) fn fix_backwards_compat(&mut self) {
        if self.folder != Path::new("") {
            return;
        }
        if self.filename != Path::new("") {
            if let Some(parent) = self.filename.parent() {
                self.folder = parent.to_owned();
            }
        }
    }
}

impl Default for FitLauncherConfigPersistence {
    fn default() -> Self {
        let persistence_session_path = directories::BaseDirs::new()
            .expect("Could not determine base directories")
            .config_local_dir() // Points to AppData\Roaming (or equivalent on other platforms)
            .join("com.fitlauncher.carrotrub")
            .join("torrentConfig")
            .join("session")
            .join("data");
        let folder = persistence_session_path;
        Self {
            disable: false,
            folder,
            fastresume: true,
            filename: PathBuf::new(),
        }
    }
}

#[serde_as]
#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(default)]
pub struct FitLauncherConfigPeerOpts {
    #[serde_as(as = "serde_with::DurationSeconds")]
    pub connect_timeout: Duration,

    #[serde_as(as = "serde_with::DurationSeconds")]
    pub read_write_timeout: Duration,
}

impl Default for FitLauncherConfigPeerOpts {
    fn default() -> Self {
        Self {
            connect_timeout: Duration::from_secs(2),
            read_write_timeout: Duration::from_secs(10),
        }
    }
}

#[serde_as]
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(default)]
pub struct FitLauncherConfigHttpApi {
    pub disable: bool,
    pub listen_addr: SocketAddr,
    pub read_only: bool,
}

impl Default for FitLauncherConfigHttpApi {
    fn default() -> Self {
        Self {
            disable: true,
            listen_addr: SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 3030)),
            read_only: false,
        }
    }
}

#[derive(Clone, Default, Serialize, Deserialize, PartialEq, Eq, Debug, Type)]
#[serde(default)]
pub struct FitLauncherConfigUpnp {
    // rename for backwards compat
    #[serde(rename = "disable")]
    pub disable_tcp_port_forward: bool,

    #[serde(default)]
    pub enable_server: bool,

    #[serde(default)]
    pub server_friendly_name: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(default)]
pub struct FitLauncherConfigAria2 {
    pub port: u32,
    pub token: Option<String>,
    pub start_daemon: bool,
}

impl Default for FitLauncherConfigAria2 {
    fn default() -> Self {
        Self {
            port: 6899,
            token: None,
            start_daemon: true,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(default)]
pub struct FitLauncherConfig {
    pub default_download_location: PathBuf,

    pub dht: FitLauncherConfigDht,
    pub tcp_listen: FitLauncherConfigTcpListen,
    pub upnp: FitLauncherConfigUpnp,
    pub persistence: FitLauncherConfigPersistence,
    pub peer_opts: FitLauncherConfigPeerOpts,
    http_api: FitLauncherConfigHttpApi,

    pub aria2_rpc: FitLauncherConfigAria2,
}

impl Default for FitLauncherConfig {
    fn default() -> Self {
        let userdirs = directories::UserDirs::new().expect("directories::UserDirs::new()");
        let download_folder = userdirs
            .download_dir()
            .map(|d| d.to_owned())
            .unwrap_or_else(|| userdirs.home_dir().join("Downloads"));

        Self {
            default_download_location: download_folder,
            dht: Default::default(),
            tcp_listen: Default::default(),
            upnp: Default::default(),
            persistence: Default::default(),
            peer_opts: Default::default(),
            http_api: Default::default(),
            aria2_rpc: FitLauncherConfigAria2 {
                port: 6899,
                token: None,
                start_daemon: true,
            },
        }
    }
}

impl FitLauncherConfig {
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.upnp.enable_server {
            if self.http_api.disable {
                anyhow::bail!("if UPnP server is enabled, you need to enable the HTTP API also.")
            }
            if self.http_api.listen_addr.ip().is_loopback() {
                anyhow::bail!(
                    "if UPnP server is enabled, you need to set HTTP API IP to 0.0.0.0 or at least non-localhost address."
                )
            }
        }
        Ok(())
    }
}
