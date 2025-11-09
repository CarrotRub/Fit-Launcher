use aria2_ws::{Client, Map, TaskOptions};
use serde_json::Value;
use tracing::error;

use crate::error::Aria2Error;

pub async fn aria2_add_uri(
    aria2_client: &Client,
    url: Vec<String>,
    dir: Option<String>,
    filename: Option<String>,
    aria2_priviledged: bool,
) -> Result<String, Aria2Error> {
    let extra_options =
        file_allocation_method(dir.as_deref().unwrap_or("."), aria2_priviledged).await;
    Ok(aria2_client
        .add_uri(
            url,
            Some(TaskOptions {
                split: Some(1),
                out: filename,
                dir,
                r#continue: Some(true),
                extra_options,
                ..TaskOptions::default()
            }),
            None,
            None,
        )
        .await?)
}

pub async fn aria2_add_torrent(
    aria2_client: &Client,
    torrent: Vec<u8>,
    dir: Option<String>,
    select_file: impl IntoIterator<Item = usize>,
) -> Result<String, Aria2Error> {
    // Convert to 1-based indices
    let select_file: String = select_file
        .into_iter()
        .map(|idx| (idx + 1).to_string())
        .collect::<Vec<_>>()
        .join(",");

    let mut options = TaskOptions {
        dir,
        r#continue: Some(true),
        ..TaskOptions::default()
    };

    if !select_file.is_empty() {
        options
            .extra_options
            .insert("select-file".to_string(), Value::String(select_file));
    }

    aria2_client
        .add_torrent(torrent, None, Some(options), None, None)
        .await
        .map_err(|e| {
            error!("Failed to add torrent: {}", e);
            Aria2Error::RPCError(format!("Failed to add torrent: {}", e))
        })
}

async fn file_allocation_method(
    dir: impl AsRef<str>,
    #[allow(unused)] aria2_priviledged: bool,
) -> Map<String, Value> {
    let dir = dir.as_ref();

    #[cfg(windows)]
    let file_allocation = {
        use std::{error::Error, sync::LazyLock};

        use crossbeam_skiplist::SkipMap;
        use listdisk_rs::{
            win32::{
                physical_disk::{MediaType, PhysicalDisk},
                utils::diskindex_by_driveletter,
            },
            wmi::WMIConnection,
        };

        static CACHE: LazyLock<SkipMap<String, MediaType>> = LazyLock::new(|| SkipMap::new());

        let media_type;
        if let Some(result) = CACHE.get(dir) {
            media_type = Ok(*result.value());
        } else {
            let dir = dir.to_string();
            media_type = tauri::async_runtime::spawn_blocking(
                move || -> Result<MediaType, Box<dyn Error + Send + Sync>> {
                    use std::{
                        collections::HashMap,
                        path::{PathBuf, absolute},
                    };

                    use listdisk_rs::wmi::FilterValue;

                    let wmi_conn =
                        WMIConnection::with_namespace_path("ROOT\\Microsoft\\Windows\\Storage")?;

                    let disk_index = diskindex_by_driveletter(
                        &wmi_conn,
                        absolute(PathBuf::from(dir))?
                            .to_string_lossy()
                            .chars()
                            .next()
                            .unwrap(),
                    )?
                    .to_string();
                    let mut filters = HashMap::new();
                    filters.insert("DeviceId".to_string(), FilterValue::String(disk_index));
                    Ok(
                        match wmi_conn.filtered_query::<PhysicalDisk>(&filters)?[..] {
                            [PhysicalDisk { media_type, .. }, ..] => media_type,
                            _ => MediaType::Unspecified,
                        },
                    )
                },
            )
            .await
            .unwrap();
        }

        let result = match &media_type {
            Ok(MediaType::SCM | MediaType::SSD) if aria2_priviledged => "falloc",
            Ok(MediaType::SCM | MediaType::SSD) => "none",
            Ok(_) => "falloc",
            Err(e) => {
                error!("failed to detect MediaType: {e}");
                "falloc"
            }
        };

        if media_type.is_ok() {
            use tracing::info;

            info!("MediaType for {dir}: {media_type:?}");
        }

        CACHE.insert(dir.into(), media_type.unwrap_or(MediaType::HDD));
        result
    };
    #[cfg(not(windows))]
    // stick to falloc, fallocate() requires no priviledge
    let file_allocation = "falloc";

    let mut extra_options = Map::new();
    extra_options.insert("file-allocation".into(), file_allocation.into());
    extra_options
}
