use std::sync::atomic::AtomicU64;

use crate::{initialize_used_cache_size, store::IOResult};

pub struct CacheManager {
    pub capaticy: AtomicU64,
    pub used_space: AtomicU64,
}

impl CacheManager {
    pub async fn new(capacity_bytes: u64) -> IOResult<Self> {
        Ok(CacheManager {
            capaticy: AtomicU64::new(capacity_bytes),
            used_space: AtomicU64::new(initialize_used_cache_size().await?),
        })
    }
}
