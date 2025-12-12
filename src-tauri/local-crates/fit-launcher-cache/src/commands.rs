use std::sync::atomic::Ordering;

use specta::specta;

use crate::{CacheManager, error::CacheError};

#[tauri::command]
#[specta]
pub fn set_capacity(
    manager: tauri::State<'_, CacheManager>,
    new_capacity: u64,
) -> Result<(), CacheError> {
    manager.capaticy.store(new_capacity, Ordering::Release);
    Ok(())
}

#[tauri::command]
#[specta]
pub fn cached_download_image(
    manager: tauri::State<'_, CacheManager>,
    image_url: String,
) -> Result<(), CacheError> {
    todo!()
}
