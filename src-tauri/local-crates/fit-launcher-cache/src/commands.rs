use std::{
    fmt::Display,
    sync::{
        Arc, LazyLock,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use base64::Engine;
use crossbeam_skiplist::SkipMap;
use fit_launcher_torrent::{functions::TorrentSession, modify_config};
use lru_cache_adaptor::FileInfo;
use specta::specta;

use fit_launcher_config::client::dns::CUSTOM_DNS_CLIENT;
use tauri::{Url, async_runtime::spawn_blocking};
use tokio::{io::AsyncWriteExt as _, sync::Semaphore};
use tracing::{debug, error, info, trace, warn};

use crate::{
    CacheManager, error::CacheError, image_path, initialize_used_cache_size, store::Command,
};

static PER_HOST_SEMAPHORE: LazyLock<SkipMap<String, Semaphore>> = LazyLock::new(SkipMap::new);
static URL_DOWNLOAD_CACHING: LazyLock<SkipMap<String, Arc<AtomicBool>>> =
    LazyLock::new(SkipMap::new);

#[tauri::command]
#[specta]
pub fn get_used_space(manager: tauri::State<'_, Arc<CacheManager>>) -> u64 {
    manager.used_space.load(Ordering::Relaxed)
}

/// Set capacity, flush cache for shrink,
/// and modify config (in-memory and on disk)
#[tauri::command]
#[specta]
pub async fn set_capacity(
    manager: tauri::State<'_, Arc<CacheManager>>,
    session: tauri::State<'_, Arc<TorrentSession>>,
    new_capacity: u64,
) -> Result<(), CacheError> {
    if new_capacity == 0 {
        return Err(CacheError::ZeroCapacity);
    }

    let old_used = manager.used_space.load(Ordering::Acquire);
    manager.capacity.store(new_capacity, Ordering::Release);

    info!("cache pool size: set to {new_capacity} B");

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

    if old_used > new_capacity {
        claim_space(&manager, (old_used - new_capacity) as isize).await;
    }

    Ok(())
}

#[tauri::command]
#[specta]
pub async fn cached_download_image(
    manager: tauri::State<'_, Arc<CacheManager>>,
    image_url: String,
) -> Result<String, CacheError> {
    let entry = URL_DOWNLOAD_CACHING
        .get_or_insert_with(image_url.clone(), || Arc::new(AtomicBool::new(false)));
    let caching = entry.value().clone();

    // Note: this is best-effort to reduce repeated download
    while caching.load(Ordering::Acquire) {
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    caching.store(true, Ordering::Release);

    // Check cache first
    if let Ok(data_uri) = data_uri_from_cache(&manager, &image_url).await {
        trace!("cache hit: {image_url}");
        caching.store(false, Ordering::Release);
        return Ok(data_uri);
    }

    let client_guard = CUSTOM_DNS_CLIENT.read().await;
    let client = &*client_guard;

    let try_times = 5;

    let req = client.get(&image_url).build().inspect_err(|_e| {
        error!("failed to construct request: {image_url:?}");
    })?;

    let host = req.url().host_str().unwrap_or_default();
    let entry = PER_HOST_SEMAPHORE.get_or_insert_with(host.into(), || Semaphore::const_new(6));
    let download_semaphore = entry.value();
    for try_ in 0..try_times {
        // follow browser behaviour https://stackoverflow.com/a/30064610/13121439
        let _sem = download_semaphore.acquire().await;

        // clone Request is safe, it's unrelated to underlying connection
        match client.execute(req.try_clone().unwrap()).await {
            Ok(resp) => {
                if !resp.status().is_success() {
                    let e = resp.error_for_status().unwrap_err();
                    error!("http error {image_url}: {e}");
                    return Err(e.into());
                }

                let mime = resp
                    .headers()
                    .get("content-type")
                    .and_then(|h| h.to_str().ok().map(str::to_string))
                    .or_else(|| {
                        let url = Url::parse(&image_url).ok()?;
                        let filename = url.path_segments()?.next_back()?;
                        let mime = mime_guess::from_path(filename).first()?;
                        Some(format!("{}/{}", mime.type_(), mime.subtype()))
                    })
                    .unwrap_or_else(|| "image/png".into());

                let bytes: Arc<Vec<u8>> = Arc::new(resp.bytes().await?.iter().as_slice().into());
                let file_size = bytes.len() as u64;

                // Return immediately, cache asynchronously
                let data_uri = encode_data_uri(&mime, bytes.clone()).await;

                let manager = manager.inner().clone();
                let image_url_clone = image_url.clone();
                let mime_clone = mime.clone();

                tauri::async_runtime::spawn(async move {
                    cache_image_async(manager, image_url_clone, mime_clone, bytes, file_size).await;
                    caching.store(false, Ordering::Release);
                });

                return Ok(data_uri);
            }
            Err(e) if try_ == try_times - 1 => {
                error!("failed to download {image_url}: {e}");
                caching.store(false, Ordering::Release);
                return Err(e.into());
            }
            Err(e) => {
                warn!("retry {image_url}: {e}");
                let delay = (500 * 2_u64.pow(try_)).min(4000);
                tokio::time::sleep(Duration::from_millis(delay)).await;
            }
        }
    }

    unreachable!()
}

async fn cache_image_async(
    manager: Arc<CacheManager>,
    image_url: String,
    mime: String,
    bytes: Arc<Vec<u8>>,
    file_size: u64,
) {
    let capacity = manager.capacity.load(Ordering::Acquire);

    // Skip if file too large
    if capacity < file_size {
        info!("skipping cache for {image_url}: file too large ({file_size} > {capacity})");
        return;
    }

    let used = manager.used_space.fetch_add(file_size, Ordering::AcqRel);
    let available = capacity.saturating_sub(used);

    let exceed = (file_size.saturating_sub(available)) as isize;

    // Only claim once,
    // it will remove at least `exceed` bytes on each call
    if exceed > 0 {
        let manager_ = manager.clone();
        tokio::task::spawn(async move {
            claim_space(&manager_, exceed).await;
        });
    }

    let mimeext = mime2ext::mime2ext(&mime).unwrap_or("png");
    let img_path = image_path(&image_url).with_extension(mimeext);

    let (tx, rx) = kanal::bounded(0);

    debug!("caching {image_url} to {}", img_path.display());

    _ = manager
        .command_tx
        .send(Command::InsertItem(
            image_url.clone(),
            img_path.clone(),
            Some(tx),
        ))
        .await;

    if let Some(parent) = img_path.parent() {
        _ = tokio::fs::create_dir_all(parent).await;
    }

    // Handle evicted file
    if let Ok(Ok(Some(old_path))) = rx.as_async().recv().await
        && let Ok(file_len) = old_path.metadata().map(|m| m.len())
    {
        manager.used_space.fetch_sub(file_len, Ordering::AcqRel);
        debug!("evicted old cache file: {old_path:?} ({file_len} bytes)");
    }

    let write_result = async {
        let mut file = tokio::fs::OpenOptions::new()
            .share_mode(0)
            .create(true)
            .write(true)
            .truncate(true)
            .open(&img_path)
            .await?;
        file.write_all(&bytes).await?;
        file.flush().await?;
        Ok::<_, std::io::Error>(())
    }
    .await;

    match write_result {
        Ok(_) => {
            debug!("successfully cached {image_url} ({file_size} bytes)");
        }
        Err(e) => {
            manager.used_space.fetch_sub(file_size, Ordering::AcqRel);
            _ = manager
                .command_tx
                .send(Command::PopItem(image_url, None))
                .await;

            error!("failed to write cache file {img_path:?}: {e}");
        }
    }
}

#[tauri::command]
#[specta]
pub async fn reclaim_space(
    manager: tauri::State<'_, Arc<CacheManager>>,
    space: isize,
) -> Result<(), CacheError> {
    claim_space(&manager, space).await;
    Ok(())
}

/// Clean all cache and try to delete files
///
/// This will not wait for real deletion
#[tauri::command]
#[specta]
pub async fn clear_image_cache(
    manager: tauri::State<'_, Arc<CacheManager>>,
) -> Result<(), CacheError> {
    manager.command_tx.send(Command::ClearCache).await?;
    manager
        .used_space
        .store(initialize_used_cache_size().await, Ordering::Release);
    Ok(())
}

/// Reclaim at least `exceed` bytes from the cache.
///
/// This function is intentionally infallible: failures are logged but don't
/// propagate errors, since cache reclamation is best-effort.
async fn claim_space(manager: &CacheManager, exceed: isize) {
    debug!("reclaim space: {exceed}");

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

            Ok(encode_data_uri(mime, Arc::new(image_raw)).await)
        }
        _ => Err(CacheError::CacheMissing),
    }
}

async fn encode_data_uri(mime: impl Display, image_raw: Arc<Vec<u8>>) -> String {
    let base64_engine = base64::engine::general_purpose::STANDARD;
    let encoded = spawn_blocking(move || base64_engine.encode(image_raw.as_ref()))
        .await
        .expect("failed to spawn encoding task");
    format!("data:{mime};base64,{encoded}")
}
