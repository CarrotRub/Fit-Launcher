use std::{
    net::{IpAddr, SocketAddr},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use hickory_resolver::{
    TokioResolver, name_server::TokioConnectionProvider, proto::xfer::Protocol,
    system_conf::read_system_conf,
};
use once_cell::sync::Lazy;
use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use tracing::{info, warn};

use crate::client::dns::FitLauncherDnsConfig;

use hickory_resolver::config::*;
use std::io;

/// Short timeout to avoid blocking the app when VPN providers block direct DNS (e.g., 1.1.1.1).
const CUSTOM_DNS_TIMEOUT: Duration = Duration::from_secs(3);

/// Persists across the session to avoid repeated failures when custom DNS is blocked.
static USE_SYSTEM_DNS_FALLBACK: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));

/// DNS resolver with automatic system fallback.
///
/// Many VPN providers block direct DNS queries to public resolvers like 1.1.1.1,
/// which would cause silent failures without this fallback mechanism. Once custom
/// DNS fails, all subsequent lookups use system DNS for the session.
#[derive(Debug, Clone)]
pub struct HickoryResolverWithProtocol {
    custom_resolver: Arc<once_cell::sync::OnceCell<TokioResolver>>,
    system_resolver: Arc<once_cell::sync::OnceCell<TokioResolver>>,
    dns_config: FitLauncherDnsConfig,
    rng: Option<rand::rngs::SmallRng>,
}

impl HickoryResolverWithProtocol {
    pub fn new(dns_config: FitLauncherDnsConfig) -> Self {
        Self {
            custom_resolver: Arc::new(once_cell::sync::OnceCell::new()),
            system_resolver: Arc::new(once_cell::sync::OnceCell::new()),
            dns_config,
            rng: None,
        }
    }

    #[allow(unused)]
    pub fn with_shuffle(mut self, shuffle: bool) -> Self {
        if shuffle {
            use rand::SeedableRng;
            self.rng = Some(rand::rngs::SmallRng::from_os_rng());
        }
        self
    }
}

impl Resolve for HickoryResolverWithProtocol {
    fn resolve(&self, name: Name) -> Resolving {
        let mut hickory_resolver = self.clone();
        Box::pin(async move {
            // Skip custom DNS entirely once we know it's blocked (e.g., by VPN).
            if USE_SYSTEM_DNS_FALLBACK.load(Ordering::Relaxed) {
                return resolve_with_system_dns(&mut hickory_resolver, &name).await;
            }

            let custom_resolver = hickory_resolver
                .custom_resolver
                .get_or_try_init(|| new_resolver_with_config(&hickory_resolver.dns_config))?;

            let lookup_result =
                tokio::time::timeout(CUSTOM_DNS_TIMEOUT, custom_resolver.lookup_ip(name.as_str()))
                    .await;

            let lookup = match lookup_result {
                Ok(Ok(ip)) => ip,
                Ok(Err(err)) => {
                    // VPN or network is blocking custom DNS; fall back to system DNS for the session.
                    warn!(
                        "Custom DNS lookup failed for {}: {}. Switching to system DNS for this session.",
                        name.as_str(),
                        err
                    );
                    USE_SYSTEM_DNS_FALLBACK.store(true, Ordering::Relaxed);
                    return resolve_with_system_dns(&mut hickory_resolver, &name).await;
                }
                Err(_) => {
                    // Timeout indicates custom DNS is unreachable (common with VPNs blocking 1.1.1.1).
                    warn!(
                        "Custom DNS lookup timed out for {}. Switching to system DNS for this session.",
                        name.as_str()
                    );
                    USE_SYSTEM_DNS_FALLBACK.store(true, Ordering::Relaxed);
                    return resolve_with_system_dns(&mut hickory_resolver, &name).await;
                }
            };

            let addrs: Addrs = if let Some(rng) = &mut hickory_resolver.rng {
                use rand::seq::SliceRandom;

                let mut ips = lookup.into_iter().collect::<Vec<_>>();
                ips.shuffle(rng);

                Box::new(ips.into_iter().map(|addr| SocketAddr::new(addr, 0)))
            } else {
                Box::new(lookup.into_iter().map(|addr| SocketAddr::new(addr, 0)))
            };

            Ok(addrs)
        })
    }
}

/// Falls back to OS-configured DNS which respects VPN routing.
async fn resolve_with_system_dns(
    hickory_resolver: &mut HickoryResolverWithProtocol,
    name: &Name,
) -> Result<Addrs, Box<dyn std::error::Error + Send + Sync>> {
    let system_resolver = hickory_resolver
        .system_resolver
        .get_or_try_init(new_system_resolver)?;

    match system_resolver.lookup_ip(name.as_str()).await {
        Ok(lookup) => {
            info!("System DNS resolved {}", name.as_str());

            let addrs: Addrs = if let Some(rng) = &mut hickory_resolver.rng {
                use rand::seq::SliceRandom;

                let mut ips = lookup.into_iter().collect::<Vec<_>>();
                ips.shuffle(rng);

                Box::new(ips.into_iter().map(|addr| SocketAddr::new(addr, 0)))
            } else {
                Box::new(lookup.into_iter().map(|addr| SocketAddr::new(addr, 0)))
            };

            Ok(addrs)
        }
        Err(err) => {
            eprintln!(
                "System DNS lookup also failed for {}: {}",
                name.as_str(),
                err
            );
            Err(err.into())
        }
    }
}

/// Uses OS DNS config which works through VPN tunnels.
fn new_system_resolver() -> io::Result<TokioResolver> {
    let (config, opts) =
        read_system_conf().map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

    Ok(
        TokioResolver::builder_with_config(config, TokioConnectionProvider::default())
            .with_options(opts)
            .build(),
    )
}

/// Aggressive timeouts (2s, 1 attempt) ensure fast fallback when custom DNS is blocked.
pub fn new_resolver_with_config(dns_config: &FitLauncherDnsConfig) -> io::Result<TokioResolver> {
    let protocol = match dns_config.protocol.to_uppercase().as_str() {
        "UDP" => Protocol::Udp,
        "HTTPS" => Protocol::Https,
        other => {
            eprintln!("Unknown protocol in dns.json: {other}");
            Protocol::Udp
        }
    };

    info!("Primary IP Address: {:#?}", dns_config.primary);

    let primary_str = dns_config.primary.clone().unwrap_or("1.1.1.1".to_string());

    let custom_socket_vec_addr: SocketAddr = match primary_str.parse::<SocketAddr>() {
        Ok(socket_addr) => socket_addr,
        Err(_) => {
            // IP without port - default to standard DNS port 53.
            let primary_ip: IpAddr = primary_str
                .parse()
                .expect("Invalid primary DNS address in dns.json");
            SocketAddr::new(primary_ip, 53)
        }
    };
    let custom_name_server_config = NameServerConfig::new(custom_socket_vec_addr, protocol);

    let mut custom_resolver_dns_config = ResolverConfig::new();
    custom_resolver_dns_config.add_name_server(custom_name_server_config);

    // Fast failure is critical - system DNS fallback handles retries.
    let mut opts = ResolverOpts::default();
    opts.timeout = Duration::from_secs(2);
    opts.attempts = 1;

    Ok(TokioResolver::builder_with_config(
        custom_resolver_dns_config,
        TokioConnectionProvider::default(),
    )
    .with_options(opts)
    .build())
}
