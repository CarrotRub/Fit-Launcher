use directories::BaseDirs;
mod resolver;
pub use resolver::HickoryResolverWithProtocol;

use crate::client::cookies::Cookies;
use crate::client::cookies::persist_response_cookies;
use reqwest::Client;
use reqwest::ClientBuilder;
use reqwest::cookie::Jar;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::io::Write;
use std::sync::Arc;
use std::sync::LazyLock;
use tauri::http::HeaderMap;
use tokio::sync::RwLock;
use tracing::error;
use tracing::info;

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct FitLauncherDnsConfig {
    pub system_conf: bool,
    pub protocol: String,
    pub primary: Option<String>,
    pub secondary: Option<String>,
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

pub fn ensure_and_load_dns_config() -> FitLauncherDnsConfig {
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

pub fn build_dns_client() -> Client {
    let dns_config = ensure_and_load_dns_config();

    let headers = HeaderMap::new();
    // headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    // headers.insert(ACCEPT_ENCODING, HeaderValue::from_static("gzip"));
    // headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-US,en;q=0.9"));
    // headers.insert(CONNECTION, HeaderValue::from_static("keep-alive"));
    // headers.insert(DNT, HeaderValue::from_static("1"));

    let cookie_jar = Arc::new(Jar::default());
    if let Ok(cookies) = Cookies::load_cookies() {
        let url = "https://fitgirl-repacks.site".parse().unwrap();
        cookie_jar.add_cookie_str(&cookies.to_header(), &url);
    }

    // * Important : The pool_max_idle_per_host should never be greater than 0 due to the "runtime dropped the dispatch task" error that can happen when running awaiting task into multiple streams.
    // * Even in terms of performance it will only be a 5% to 10% increase but the drawback is too big and this is too unstable.
    let mut client_builder = ClientBuilder::new()
        .use_rustls_tls()
        .tcp_nodelay(true)
        .http1_only()
        .gzip(true)
        .brotli(true)
        .user_agent("curl/8.11.0")
        .default_headers(headers)
        .cookie_provider(cookie_jar)
        .pool_max_idle_per_host(0);
    // Conditionally set the custom DNS resolver only if sys_conf is disabled
    if !dns_config.system_conf {
        client_builder =
            client_builder.dns_resolver(Arc::new(HickoryResolverWithProtocol::new(dns_config)));
    }

    client_builder
        .build()
        .expect("Failed to build custom DNS reqwest client")
}

pub async fn refresh_cookies() {
    let new_client = build_dns_client();
    *CUSTOM_DNS_CLIENT.write().await = new_client;
}

pub async fn warmup_connection(url: &str) {
    let response = {
        let client = CUSTOM_DNS_CLIENT.read().await;
        client
            .get(url)
            .send()
            .await
            .expect("Error in response during warmup")
    }; // read lock dropped here
    persist_response_cookies(&response);
    refresh_cookies().await;
}

// Only ONE custom_dns_client, protocol decided by the DnsConfig file found in the
pub static CUSTOM_DNS_CLIENT: LazyLock<RwLock<Client>> =
    LazyLock::new(|| RwLock::new(build_dns_client()));
