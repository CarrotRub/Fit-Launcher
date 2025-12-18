use aria2_ws::{Client, Map, TaskOptions, response::Status};
use fit_launcher_torrent::FitLauncherConfigAria2;
use serde_json::Value;

use tracing::error;

use crate::error::Aria2Error;

pub async fn aria2_add_uri(
    aria2_client: &Client,
    url: Vec<String>,
    dir: Option<String>,
    filename: Option<String>,
    aria2_cfg: FitLauncherConfigAria2,
) -> Result<String, Aria2Error> {
    let mut options = TaskOptions {
        split: Some(1),
        out: filename,
        dir: dir.clone(),
        r#continue: Some(true),
        ..TaskOptions::default()
    };

    #[cfg(windows)]
    {
        if aria2_cfg.file_allocation.is_auto() {
            file_allocation_method(&mut options.extra_options, dir.as_deref().unwrap_or(".")).await;
        };
    }

    set_proxy_from_sys(&mut options.extra_options);

    Ok(aria2_client.add_uri(url, Some(options), None, None).await?)
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

pub async fn aria2_get_all_list(aria2_client: &Client) -> Result<Vec<Status>, Aria2Error> {
    let mut active = aria2_client.tell_active().await?;
    let mut waiting = aria2_client.tell_waiting(0, 100).await?;
    let mut stopped = aria2_client.tell_stopped(0, 100).await?;

    let mut list: Vec<Status> = Vec::new();

    list.append(&mut active);
    list.append(&mut waiting);
    list.append(&mut stopped);

    Ok(list)
}

#[cfg(windows)]
async fn file_allocation_method(extra_options: &mut Map<String, Value>, dir: impl AsRef<str>) {
    let dir = dir.as_ref();

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

        static CACHE: LazyLock<SkipMap<String, MediaType>> = LazyLock::new(SkipMap::new);

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

        // On Windows, `falloc` relies on SetFileValidData, which requires
        // Administrator privileges since it could potentially leak data from the raw disk.
        //
        // If privilege is missing, aria2 will fallback to `prealloc`,
        // which fills the file with zeros before actual writing. This fallback
        // is acceptable for HDD usage.
        //
        // `none` disables pre-allocation entirely, writing the file directly.
        //
        // On Linux/Mac, aria2 will always use `falloc` in auto mode, as
        // `fallocate()` on Unix-like systems does not require root access.
        let result = match &media_type {
            Ok(MediaType::SCM | MediaType::SSD) => "none",
            Ok(_) => "falloc",
            Err(e) => {
                error!("failed to detect MediaType: {e}");
                "falloc"
            }
        };

        if media_type.is_ok() {
            use tracing::debug;
            debug!("MediaType for {dir}: {media_type:?}");
        }

        CACHE.insert(dir.into(), media_type.unwrap_or(MediaType::HDD));
        result
    };

    extra_options.insert("file-allocation".into(), file_allocation.into());
}

/// This function is thread safe (see https://stackoverflow.com/a/706348)
///
/// On Windows, this reads system proxy from HKCU,
/// and currently ignoring group policy based proxy settings.
///
/// Which requires checking policy `Make proxy settings per-machine (rather than per-user)`
///
/// On Linux, this will only read KDE and GNOME proxy settings.
/// In the oppsite, reqwest only takes care for HTTP_PROXY, HTTPS_PROXY,
/// ALL_PROXY (and lowercase variants), but not desktop settings.
fn set_proxy_from_sys(extra_options: &mut Map<String, Value>) {
    #[cfg(windows)]
    {
        const REGISTRY_PATH: &str =
            r#"Software\Microsoft\Windows\CurrentVersion\Internet Settings"#;
        use tracing::warn;
        use winreg::RegKey;
        use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};

        let registry = RegKey::predef(HKEY_CURRENT_USER);
        let Ok(ie_settings) = registry.open_subkey_with_flags(REGISTRY_PATH, KEY_READ) else {
            warn!("failed to read system proxy: open registry failed");
            return;
        };

        let enabled = ie_settings
            .get_value::<u32, _>("ProxyEnable")
            .is_ok_and(|enable| enable == 1);
        // ignore disabled proxy
        if !enabled {
            use tracing::debug;
            debug!("skip to read system proxy: proxy disabled");
            return;
        }

        if let Ok(proxy_server) = ie_settings.get_value::<String, _>("ProxyServer") {
            // schema is not needed here, will be inferred as http proxy
            // https://aria2.github.io/manual/en/html/aria2c.html#cmdoption-http-proxy
            extra_options.insert("http-proxy".into(), proxy_server.clone().into());
            extra_options.insert("https-proxy".into(), proxy_server.into());
        }

        if let Ok(proxy_override) = ie_settings.get_value::<String, _>("ProxyOverride") {
            let no_proxy = proxy_override
                .split(';')
                .filter(|host| {
                    // Skip <local> and wildcards (TODO: support wildcard matching)
                    // https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-ie-clientnetworkprotocolimplementation-hklmproxyoverride#values
                    *host != "<local>" && !host.contains('*')
                })
                .collect::<Vec<_>>()
                .join(",");

            extra_options.insert("no-proxy".into(), no_proxy.into());
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(sysproxy::Sysproxy {
            enable: true,
            host,
            port,
            // on macos and linux desktop, this will be comma seperated CIDR/domain name.
            bypass,
        }) = sysproxy::Sysproxy::get_system_proxy()
        {
            let proxy_server = format!("{host}:{port}");
            extra_options.insert("http-proxy".into(), proxy_server.clone().into());
            extra_options.insert("https-proxy".into(), proxy_server.into());
            extra_options.insert("no-proxy".into(), bypass.into());
        }
    }
}
