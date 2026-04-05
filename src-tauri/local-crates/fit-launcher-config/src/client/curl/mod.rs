use crate::client::cookies::Cookies;
use crate::client::dns::{FitLauncherDnsConfig, ensure_and_load_dns_config};
use curl::easy::Easy;
use std::sync::{LazyLock, Mutex};
use tracing::{error, info, warn};

const MAX_IDLE: usize = 8;

pub static CURL_POOL: LazyLock<Mutex<Vec<Easy>>> = LazyLock::new(|| Mutex::new(Vec::new()));

pub fn acquire_handle() -> Easy {
    let mut pool = CURL_POOL.lock().unwrap();
    pool.pop().unwrap_or_else(build_curl_handle)
}

pub fn release_handle(mut easy: Easy) {
    // clears URL, callbacks etc. but keeps TCP connection warm so we good
    easy.reset();
    apply_persistent_config(&mut easy);

    let mut pool = CURL_POOL.lock().unwrap();
    if pool.len() < MAX_IDLE {
        pool.push(easy);
    }
}

pub fn build_curl_handle() -> Easy {
    let mut easy = Easy::new();
    apply_persistent_config(&mut easy);
    easy
}

/// Everything that needs to be reapplied after Easy::reset() or on a fresh handle.
fn apply_persistent_config(easy: &mut Easy) {
    let dns_config = ensure_and_load_dns_config();
    apply_dns_to_handle(easy, &dns_config);

    if let Ok(cookies) = Cookies::load_cookies() {
        let header = cookies.to_header();
        if !header.is_empty()
            && let Err(e) = easy.cookie(&header)
        {
            error!("Failed to set cookies on curl handle: {}", e);
        }
    }

    easy.follow_location(true).unwrap();
    easy.useragent(&format!("curl/{}", curl::Version::get().version()))
        .unwrap();
}

fn apply_dns_to_handle(easy: &mut Easy, config: &FitLauncherDnsConfig) {
    if config.system_conf {
        info!("libcurl using system DNS");
        return;
    }

    match config.protocol.to_uppercase().as_str() {
        "HTTPS" => {
            if let Some(primary) = &config.primary {
                let doh_url = format!("https://{}/dns-query", primary);
                info!("libcurl using DoH: {}", doh_url);
                if let Err(e) = easy.doh_url(Some(&doh_url)) {
                    warn!(
                        "libcurl doh_url() failed: {}. Falling back to system DNS.",
                        e
                    );
                }
            }
        }
        _ => {
            if let Some(servers) = build_dns_servers_string(config) {
                info!("libcurl using DNS servers: {}", servers);
                if let Err(e) = easy.dns_servers(&servers) {
                    warn!(
                        "libcurl dns_servers() not supported (needs c-ares): {}. Falling back to system DNS.",
                        e
                    );
                }
            }
        }
    }
}

/// Builds "1.1.1.1,1.0.0.1" style string for CURLOPT_DNS_SERVERS.
/// Note: protocol (UDP/HTTPS) is not configurable via this option cuz
/// libcurl's c-ares always uses UDP. DoH would need CURLOPT_DOH_URL instead.
fn build_dns_servers_string(config: &FitLauncherDnsConfig) -> Option<String> {
    let mut servers = vec![];
    if let Some(primary) = &config.primary {
        servers.push(primary.clone());
    }
    if let Some(secondary) = &config.secondary {
        servers.push(secondary.clone());
    }
    if servers.is_empty() {
        None
    } else {
        Some(servers.join(","))
    }
}
