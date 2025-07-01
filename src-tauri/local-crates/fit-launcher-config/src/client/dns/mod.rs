use directories::BaseDirs;

use once_cell::sync::Lazy;
use reqwest::Client;
use reqwest::ClientBuilder;
use reqwest::header::COOKIE;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::io::Write;
use std::sync::Arc;
use tauri::http::HeaderValue;
use tracing::error;
use tracing::info;
use tracing::warn;

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct FitLauncherDnsConfig {
    system_conf: bool,
    protocol: String,
    primary: Option<String>,
    secondary: Option<String>,
}

impl Default for FitLauncherDnsConfig {
    fn default() -> Self {
        FitLauncherDnsConfig {
            system_conf: false,
            protocol: "UDP".to_string(),
            primary: Some("1.1.1.1".to_string()),
            secondary: Some("1.0.0.1".to_string()),
        }
    }
}

impl FitLauncherDnsConfig {
    #[allow(clippy::get_first)]
    fn default_system() -> Self {
        info!("System Conf Enabled");
        FitLauncherDnsConfig {
            system_conf: true,
            protocol: "UDP".to_string(),
            primary: Some("1.1.1.1".to_string()),
            secondary: Some("1.0.0.1".to_string()),
        }
    }
}

fn ensure_and_load_dns_config() -> FitLauncherDnsConfig {
    let base_dirs = BaseDirs::new().expect("Failed to determine base directories");
    let config_path = base_dirs
        .config_dir()
        .join("com.fitlauncher.carrotrub")
        .join("fitgirlConfig")
        .join("settings")
        .join("dns");

    if !config_path.exists() {
        fs::create_dir_all(&config_path).expect("Failed to create DNS config directory");
    }

    let config_file = config_path.join("dns.json");
    if !config_file.exists() {
        let default_config = FitLauncherDnsConfig::default();

        let default_config_data = serde_json::to_string_pretty(&default_config)
            .expect("Failed to serialize default DNS config");

        let mut file = fs::File::create(&config_file).expect("Failed to create dns.json file");
        file.write_all(default_config_data.as_bytes())
            .expect("Failed to write to dns.json file");
    }

    let config_data =
        fs::read_to_string(config_file).expect("Failed to read dns.json configuration file");
    let mut dns_config: FitLauncherDnsConfig = match serde_json::from_str(&config_data) {
        Ok(conf) => conf,
        Err(e) => {
            error!("Error serializing dns config from file : {}", e);
            error!("Using old config, updating...");
            FitLauncherDnsConfig::default()
        }
    };

    if dns_config.system_conf {
        dns_config = FitLauncherDnsConfig::default_system();
    }

    dns_config
}

// Only ONE custom_dns_client, protocol decided by the DnsConfig file found in the
pub static CUSTOM_DNS_CLIENT: Lazy<Client> = Lazy::new(|| {
    let dns_config = ensure_and_load_dns_config();

    // * Important : The pool_max_idle_per_host should never be greater than 0 due to the "runtime dropped the dispatch task" error that can happen when running awaiting task into multiple streams.
    // * Even in terms of performance it will only be a 5% to 10% increase but the drawback is too big and this is too unstable.
    let mut client_builder = ClientBuilder::new()
            .use_rustls_tls()
            .gzip(true)
            .brotli(true)
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36")
            .pool_max_idle_per_host(0);

    match Cookies::load_cookies() {
        Ok(cookies) => {
            if let Ok(value) = HeaderValue::from_str(&cookies.to_header()) {
                client_builder = client_builder
                    .default_headers(reqwest::header::HeaderMap::from_iter([(COOKIE, value)]));
            } else {
                error!("invalid ASCII character found in cookies value");
            }
        }
        Err(e) => {
            warn!("failed to read cookies: {e}");
        }
    }

    // Conditionally set the custom DNS resolver only if sys_conf is disabled
    if !dns_config.system_conf {
        client_builder =
            client_builder.dns_resolver(Arc::new(HickoryResolverWithProtocol::new(dns_config)));
    }

    client_builder
        .build()
        .expect("Failed to build custom DNS reqwest client")
});

mod resolver;
pub use resolver::HickoryResolverWithProtocol;

use crate::client::cookies::Cookies;
