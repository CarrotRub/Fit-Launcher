use std::sync::{Arc, atomic::AtomicU64};

use fit_launcher_torrent::load_config;
use kanal::AsyncSender;

use crate::{error::CacheError, initialize_used_cache_size, spawn_cache_manager, store::Command};

pub struct CacheManager {
    pub(crate) capaticy: AtomicU64,
    pub(crate) used_space: AtomicU64,
    pub(crate) command_tx: Arc<AsyncSender<Command>>,
}

impl CacheManager {
    /// note: this will also initialize the LRUCache.
    pub async fn new() -> Result<Self, CacheError> {
        let cache_capacity = load_config().general.cache_size;
        let (tx, rx) = kanal::bounded(1024);

        spawn_cache_manager(rx);

        Ok(CacheManager {
            capaticy: AtomicU64::new(cache_capacity),
            used_space: AtomicU64::new(initialize_used_cache_size().await?),
            command_tx: Arc::new(tx.to_async()),
        })
    }
}
