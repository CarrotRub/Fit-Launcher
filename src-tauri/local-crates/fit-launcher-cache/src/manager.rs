use std::sync::atomic::AtomicU64;

use fit_launcher_torrent::load_config;

use crate::{initialize_used_cache_size, store::IOResult};

pub struct CacheManager {
    pub capaticy: AtomicU64,
    pub used_space: AtomicU64,
}

impl CacheManager {
    pub async fn new() -> IOResult<Self> {
        let cache_capacity = load_config().general.cache_size;
        Ok(CacheManager {
            capaticy: AtomicU64::new(cache_capacity),
            used_space: AtomicU64::new(initialize_used_cache_size().await?),
        })
    }
}
