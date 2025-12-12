use std::{
    fs::{File, OpenOptions},
    io::{BufReader, BufWriter},
    path::{Path, PathBuf},
    time::Duration,
};

use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use specta::Type;
use tracing::error;

use crate::legacy_config::LegacyFitLauncherConfig;

///
/// 2. Aria2 RPC block
///
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug)]
#[serde(default)]
pub struct FitLauncherConfigAria2 {
    pub port: u16,
    pub token: Option<String>,
    pub start_daemon: bool,
    pub file_allocation: FileAllocation,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug, strum::EnumIs)]
pub enum FileAllocation {
    Auto,
    Falloc,
    Prealloc,
    None,
}

impl Default for FitLauncherConfigAria2 {
    fn default() -> Self {
        Self {
            port: 6899,
            token: None,
            start_daemon: true,
            file_allocation: FileAllocation::Auto,
        }
    }
}

//
// 3. V2 – user config (the one the UI will edit from now on)
//
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug)]
pub struct General {
    pub download_dir: PathBuf,
    #[serde(default = "General::default_concurrent_downloads")]
    pub concurrent_downloads: u32,
    #[serde(default = "General::default_cache_size")]
    pub cache_size: u64,
}

impl General {
    fn default_concurrent_downloads() -> u32 {
        5
    }

    /// 512 MiB
    fn default_cache_size() -> u64 {
        512 * 0x100000
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
            // 512 MiB by default
            cache_size: Self::default_cache_size(),
        }
    }
}

/// In bytes/sec – `None` means unlimited
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Type, Debug, Default)]
#[serde(default, rename_all = "kebab-case")]
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
#[serde(rename_all = "kebab-case")]
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
#[serde(default, rename_all = "kebab-case")]
pub struct Bittorrent {
    /// Whether DHT is enabled for peer discovery.
    /// Disabling this will reduce the ability to find peers in public swarms.
    pub enable_dht: bool,

    /// The port aria2 will listen on for incoming BitTorrent peer connections.
    /// todo: Add randomization if port is blocked
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
            seed_ratio: None,
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
pub(crate) fn write_cfg<T: Serialize>(path: impl AsRef<Path>, cfg: &T) -> anyhow::Result<()> {
    let path = path.as_ref();
    std::fs::create_dir_all(Path::new(path).parent().context("no parent")?)?;
    let tmp_path = path.with_file_name(
        path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
            + ".tmp",
    );
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

pub fn load_config() -> FitLauncherConfigV2 {
    let config_dir = directories::BaseDirs::new()
        .expect("Could not determine base directories")
        .config_dir() // Points to AppData\Roaming (or equivalent on other platforms)
        .join("com.fitlauncher.carrotrub");
    let v2_path = config_dir.join("config.json");
    let legacy_path = config_dir.join("torrentConfig").join("config.json");

    load_or_migrate(&legacy_path, &v2_path)
}

/// Load the config (migrating from legacy if needed). Returns the in‑memory V2 object.
/// If a legacy config is found, it is replaced on disk and the old `torrentConfig` folder
/// is removed.
pub(crate) fn load_or_migrate(
    legacy_path: impl AsRef<Path>,
    v2_path: impl AsRef<Path>,
) -> FitLauncherConfigV2 {
    if let Ok(cfg) = read_cfg::<FitLauncherConfigV2>(&v2_path) {
        return cfg;
    }

    #[allow(deprecated)]
    if let Ok(legacy) = read_cfg::<LegacyFitLauncherConfig>(legacy_path) {
        let new_cfg: FitLauncherConfigV2 = legacy.into();
        _ = write_cfg(&v2_path, &new_cfg).inspect_err(|e| {
            error!("Failed to place default configuration: {e}");
        });

        return new_cfg;
    }

    let fresh = FitLauncherConfigV2::default();
    _ = write_cfg(v2_path, &fresh).inspect_err(|e| {
        error!("Failed to place default configuration: {e}");
    });
    fresh
}

fn read_cfg<T: for<'de> Deserialize<'de>>(path: impl AsRef<Path>) -> anyhow::Result<T> {
    let rdr = BufReader::new(File::open(path)?);
    let cfg = serde_json::from_reader(rdr)?;
    Ok(cfg)
}
