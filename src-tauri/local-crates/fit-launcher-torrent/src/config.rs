use std::{
    fs::{File, OpenOptions},
    io::{BufReader, BufWriter},
    net::{Ipv4Addr, SocketAddr, SocketAddrV4},
    path::{Path, PathBuf},
    time::Duration,
};

use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use specta::Type;

//
// 1. Legacy config (kept for migration only)
//
#[deprecated(note = "Replaced by `FitLauncherConfigV2` – will be removed in the next release")]
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

///
/// 2. Aria2 RPC block
///
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug)]
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

//
// 3. V2 – user config (the one the UI will edit from now on)
//
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug)]
#[serde(default)]
pub struct General {
    pub download_dir: PathBuf,
    #[serde(default = "General::default_concurrent_downloads")]
    pub concurrent_downloads: u32,
}

impl General {
    fn default_concurrent_downloads() -> u32 {
        5
    }
}

impl Default for General {
    fn default() -> Self {
        let userdirs = directories::UserDirs::new().expect("UserDirs::new()");
        Self {
            download_dir: userdirs
                .download_dir()
                .map(|d| d.to_owned())
                .unwrap_or_else(|| userdirs.home_dir().join("Downloads")),
            concurrent_downloads: Self::default_concurrent_downloads(),
        }
    }
}

/// In bytes/sec – `None` means unlimited
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug, Default)]
#[serde(default)]
pub struct TransferLimits {
    /// In bytes/sec – `None` means unlimited
    pub max_overall_download: Option<u64>,
    /// In bytes/sec – `None` means unlimited
    pub max_overall_upload: Option<u64>,
    /// In bytes/sec – `None` means unlimited
    pub max_download: Option<u64>,
    /// In bytes/sec – `None` means unlimited
    pub max_upload: Option<u64>,
}

#[serde_as]
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug)]
#[serde(default)]
pub struct Connection {
    pub max_connection_per_server: u32,
    pub split: u32,
    pub min_split_size: u64,
    pub connect_timeout: Duration,
    pub rw_timeout: Duration,
}

impl Default for Connection {
    fn default() -> Self {
        Self {
            max_connection_per_server: 5,
            split: 16,
            min_split_size: 1 << 20, // 1 MiB
            connect_timeout: Duration::from_secs(15),
            rw_timeout: Duration::from_secs(30),
        }
    }
}

/// https://aria2.github.io/manual/en/html/aria2c.html
#[derive(Clone, Serialize, Deserialize, PartialEq, Type, Debug)]
#[serde(default)]
pub struct Bittorrent {
    /// Whether DHT is enabled for peer discovery.
    /// Disabling this will reduce the ability to find peers in public swarms.
    pub enable_dht: bool,

    /// The port aria2 will listen on for incoming BitTorrent peer connections.
    pub listen_port: u16,

    /// The maximum number of peers to connect to for each torrent.
    pub max_peers: u32,

    /// The upload/download ratio after which seeding should stop.
    /// If `None`, no ratio limit is enforced (infinite seeding allowed).
    /// IF `seed_time` and `seed_ratio` are set, seeding will ends when at least one of the conditions is satisfied.
    pub seed_ratio: Option<f32>,

    /// The time (in minutes) to continue seeding after the download completes.
    /// If `None`, no time limit is enforced (infinite seeding allowed).
    pub seed_time: Option<u32>,
}

impl Default for Bittorrent {
    fn default() -> Self {
        Self {
            enable_dht: true,
            listen_port: 51413,
            max_peers: 60,
            seed_ratio: Some(1.0),
            seed_time: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Type, Debug)]
#[serde(default)]
#[derive(Default)]
pub struct FitLauncherConfigV2 {
    pub general: General,
    pub limits: TransferLimits,
    pub network: Connection,
    pub bittorrent: Bittorrent,
    pub rpc: FitLauncherConfigAria2,
}

//
// 4. Migration path
//
#[allow(deprecated)]
impl From<LegacyFitLauncherConfig> for FitLauncherConfigV2 {
    fn from(old: LegacyFitLauncherConfig) -> Self {
        Self {
            general: General {
                download_dir: old.default_download_location,
                ..Default::default()
            },
            limits: Default::default(),
            network: Connection {
                connect_timeout: old.peer_opts.connect_timeout,
                rw_timeout: old.peer_opts.read_write_timeout,
                ..Default::default()
            },
            bittorrent: Bittorrent {
                enable_dht: !old.dht.disable,
                listen_port: old.tcp_listen.min_port,
                ..Default::default()
            },
            rpc: old.aria2_rpc,
        }
    }
}

//
// 5. Helpers for TorrentSession
//
fn read_cfg<T: for<'de> Deserialize<'de>>(path: &str) -> anyhow::Result<T> {
    let rdr = BufReader::new(File::open(path)?);
    let cfg = serde_json::from_reader(rdr)?;
    Ok(cfg)
}

fn write_cfg<T: Serialize>(path: &str, cfg: &T) -> anyhow::Result<()> {
    std::fs::create_dir_all(Path::new(path).parent().context("no parent")?)?;
    let tmp_path = format!("{}.tmp", path);
    let mut tmp = BufWriter::new(
        OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&tmp_path)?,
    );
    serde_json::to_writer_pretty(&mut tmp, cfg)?;
    std::fs::rename(tmp_path, path)?;
    Ok(())
}

/// Load the config (migrating from legacy if needed). Returns the in‑memory V2 object.
/// If a legacy config is found, it is replaced on disk and the old `torrentConfig` folder
/// is removed.
pub fn load_or_migrate(path: &str) -> anyhow::Result<FitLauncherConfigV2> {
    if let Ok(cfg) = read_cfg::<FitLauncherConfigV2>(path) {
        return Ok(cfg);
    }

    #[allow(deprecated)]
    if let Ok(legacy) = read_cfg::<LegacyFitLauncherConfig>(path) {
        let new_cfg: FitLauncherConfigV2 = legacy.into();
        write_cfg(path, &new_cfg)?;

        // delete obsolete "torrentConfig" in the same parent dir
        if let Some(parent) = Path::new(path).parent() {
            let _ = std::fs::remove_dir_all(parent.join("torrentConfig"));
        }

        return Ok(new_cfg);
    }

    let fresh = FitLauncherConfigV2::default();
    write_cfg(path, &fresh)?;
    Ok(fresh)
}
