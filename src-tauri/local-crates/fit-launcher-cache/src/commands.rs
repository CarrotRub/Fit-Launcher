use std::{
    fmt::Display,
    fs::Metadata,
    sync::{Arc, atomic::Ordering},
};

use base64::Engine;
use lru_cache_adaptor::FileInfo;
use mime_guess::Mime;
use specta::specta;

use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use tauri::Url;

use crate::{
    CacheManager, error::CacheError, image_path, initialize_used_cache_size, store::Command,
};

/// Set capacity without flushing cache
///
/// This will literally never fail
#[tauri::command]
#[specta]
pub fn set_capacity(
    manager: tauri::State<'_, Arc<CacheManager>>,
    new_capacity: u64,
) -> Result<(), CacheError> {
    manager.capaticy.store(new_capacity, Ordering::Release);
    Ok(())
}

#[tauri::command]
#[specta]
pub async fn cached_download_image(
    manager: tauri::State<'_, Arc<CacheManager>>,
    image_url: String,
) -> Result<String, CacheError> {
    if let Ok(data_uri) = data_uri_from_cache(&manager, &image_url).await {
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
                    return Err(resp.error_for_status().unwrap_err())?;
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
                    let used = manager
                        .used_space
                        .fetch_add(file_size as _, Ordering::AcqRel);
                    let free = total - used;

                    let exceed = (file_size - free) as isize;
                    claim_space(&manager, exceed).await;

                    let mimeext = mime_
                        .parse::<Mime>()
                        .ok()
                        .and_then(|m| m.suffix().map(|suffix| suffix.to_string()))
                        .unwrap_or_else(|| "png".into());

                    let img_path = image_path(&image_url).with_extension(mimeext);

                    let (tx, rx) = kanal::bounded(0);

                    _ = manager
                        .command_tx
                        .send(Command::InsertItem(image_url, img_path.clone(), Some(tx)))
                        .await;
                    _ = tokio::fs::write(&img_path, &*bytes_).await;

                    if let Ok(Ok(Some(path))) = rx.as_async().recv().await {
                        if let Ok(file_len) = path.metadata().as_ref().map(Metadata::len) {
                            manager.used_space.fetch_sub(file_len, Ordering::AcqRel);
                        }
                    }
                });

                return Ok(encode_data_uri(mime, &*bytes));
            }
            Err(e) if try_ == try_times - 1 => return Err(e)?,
            Err(_) => continue,
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
    let (tx, rx) = kanal::bounded(0);
    _ = manager
        .command_tx
        .send(Command::ReclaimSpace(exceed, tx))
        .await;
    if let Ok(Ok(files)) = rx.as_async().recv().await {
        for FileInfo { file_size, .. } in files {
            manager.used_space.fetch_sub(file_size, Ordering::AcqRel);
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
