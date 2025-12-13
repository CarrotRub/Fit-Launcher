use std::{
    fmt::Display,
    fs::Metadata,
    sync::{Arc, atomic::Ordering},
};

use base64::Engine;
use fit_launcher_torrent::{functions::TorrentSession, modify_config};
use lru_cache_adaptor::FileInfo;
use mime_guess::Mime;
use specta::specta;

use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use tauri::Url;
use tracing::{error, info, warn};

use crate::{
    CacheManager, error::CacheError, image_path, initialize_used_cache_size, store::Command,
};

/// Set capacity without flushing cache
///
/// This will literally never fail
#[tauri::command]
#[specta]
pub async fn set_capacity(
    manager: tauri::State<'_, Arc<CacheManager>>,
    session: tauri::State<'_, TorrentSession>,
    new_capacity: u64,
) -> Result<(), CacheError> {
    let old_capacity = manager.capaticy.load(Ordering::Acquire);
    manager.capaticy.store(new_capacity, Ordering::Release);

    info!("cache pool size: {old_capacity} -> {new_capacity}");

    modify_config(|cfg| {
        cfg.cache.cache_size = new_capacity;
    })
    .expect("Error modifying config for cache capacity");

    let mut current_config = session.config().await;
    current_config.cache.cache_size = new_capacity;
    session.configure(current_config).await.map_err(|e| {
        error!("Error updating in-memory config: {:?}", e);
        CacheError::IO(format!("Error updating in-memory config: {e:?}"))
    })?;

    if old_capacity > new_capacity {
        claim_space(&manager, (old_capacity - new_capacity) as isize).await;
    }

    Ok(())
}

/// Download image, possibly add to LRUCache
///
/// return: data URI, for example `data:image/png;base64,...`
#[tauri::command]
#[specta]
pub async fn cached_download_image(
    manager: tauri::State<'_, Arc<CacheManager>>,
    image_url: String,
) -> Result<String, CacheError> {
    if let Ok(data_uri) = data_uri_from_cache(&manager, &image_url).await {
        info!("cache hit: {image_url}");
        return Ok(data_uri);
    }
    let client = CUSTOM_DNS_CLIENT.read().await.clone();

    let try_times = 5;
    for try_ in 0..try_times {
        match client
            // ignoring `if-modified-since` header,
            // because we don't want more accurate cache control
            .execute(client.get(&image_url).build().unwrap())
            .await
        {
            Ok(resp) => {
                drop(client);

                if !resp.status().is_success() {
                    let e = resp.error_for_status().unwrap_err();
                    error!("http erorr {image_url}: {e}");
                    return Err(e)?;
                }

                let mime = resp
                    .headers()
                    .get("content-type")
                    .and_then(|h| h.to_str().ok().map(str::to_string))
                    .or_else(|| {
                        let url = Url::parse(&image_url).ok()?;
                        let filename = url.path_segments()?.last()?;

                        let mime = mime_guess::from_path(filename).first()?;
                        let type_ = mime.type_();
                        let subtype = mime.subtype();

                        Some(format!("{type_}/{subtype}"))
                    })
                    .unwrap_or_else(|| "image/png".into());
                let bytes = Arc::new(resp.bytes().await?);
                let file_size = bytes.len() as u64;

                let manager = manager.inner().clone();
                let mime_ = mime.clone();
                let bytes_ = bytes.clone();
                tauri::async_runtime::spawn(async move {
                    let total = manager.capaticy.load(Ordering::Acquire);

                    // if file was too large, skip caching it
                    if total < file_size {
                        return;
                    }

                    let used = manager
                        .used_space
                        .fetch_add(file_size as _, Ordering::AcqRel);
                    let free = total - used;

                    let exceed = (file_size as i64 - free as i64) as isize;

                    if exceed > 0 {
                        claim_space(&manager, exceed).await;
                    }

                    let mimeext = mime_
                        .parse::<Mime>()
                        .ok()
                        .and_then(|m| m.suffix().map(|suffix| suffix.to_string()))
                        .unwrap_or_else(|| "png".into());

                    let img_path = image_path(&image_url).with_extension(mimeext);

                    let (tx, rx) = kanal::bounded(0);

                    info!("cached {image_url} to {img_path:?}");
                    _ = manager
                        .command_tx
                        .send(Command::InsertItem(image_url, img_path.clone(), Some(tx)))
                        .await;

                    if let Some(parent) = img_path.parent() {
                        _ = tokio::fs::create_dir_all(parent).await;
                    }
                    _ = tokio::fs::write(&img_path, &*bytes_).await;

                    if let Ok(Ok(Some(path))) = rx.as_async().recv().await {
                        if let Ok(file_len) = path.metadata().as_ref().map(Metadata::len) {
                            manager.used_space.fetch_sub(file_len, Ordering::AcqRel);
                        }
                    }
                });

                return Ok(encode_data_uri(mime, &*bytes));
            }
            Err(e) if try_ == try_times - 1 => {
                error!("failed to download {image_url}: {e}");
                return Err(e)?;
            }
            Err(e) => {
                warn!("retry {image_url}: {e}");
                continue;
            }
        }
    }

    unreachable!()
}

#[tauri::command]
#[specta]
pub async fn reclaim_space(
    manager: tauri::State<'_, Arc<CacheManager>>,
    space: isize,
) -> Result<(), CacheError> {
    Ok(claim_space(&manager, space).await)
}

/// Clean all cache and try to delete files
///
/// This will not wait for real deletion, since windows file deletion happens immediately
#[tauri::command]
#[specta]
pub async fn clean_cache(manager: tauri::State<'_, Arc<CacheManager>>) -> Result<(), CacheError> {
    manager.command_tx.send(Command::ClearCache).await?;
    manager
        .used_space
        .store(initialize_used_cache_size().await?, Ordering::Release);
    Ok(())
}

async fn claim_space(manager: &CacheManager, exceed: isize) {
    info!("reclaim space: {exceed}");

    let (tx, rx) = kanal::bounded(0);
    _ = manager
        .command_tx
        .send(Command::ReclaimSpace(exceed, tx))
        .await;
    match rx.as_async().recv().await {
        Err(_) => (),
        Ok(Err(e)) => {
            info!("failed to claim space: {e}");
        }
        Ok(Ok(files)) => {
            for FileInfo {
                file_path,
                file_size,
                ..
            } in files
            {
                info!("removed cache: {file_path:?}");
                manager.used_space.fetch_sub(file_size, Ordering::AcqRel);
            }
        }
    }
}

async fn data_uri_from_cache(
    manager: &CacheManager,
    url: impl Into<String>,
) -> Result<String, CacheError> {
    let (tx, rx) = kanal::bounded(0);
    manager
        .command_tx
        .send(Command::AccessItem(url.into(), tx))
        .await?;
    let result = rx.as_async().recv().await;
    match result {
        Ok(Ok(Some(path))) if path.exists() => {
            let mime = mime_guess::from_path(&path)
                .first()
                .ok_or(CacheError::MimeGuess)?;
            let image_raw = tokio::fs::read(path).await?;
            let mime = format!("{}/{}", mime.type_(), mime.subtype());

            Ok(encode_data_uri(mime, image_raw))
        }
        _ => Err(CacheError::CacheMissing),
    }
}

fn encode_data_uri(mime: impl Display, image_raw: impl AsRef<[u8]>) -> String {
    let base64_engine = base64::engine::general_purpose::STANDARD;
    let encoded = base64_engine.encode(image_raw.as_ref());
    format!("data:{mime};base64,{encoded}")
}
