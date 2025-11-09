use std::{
    net::{IpAddr, SocketAddr},
    sync::Arc,
};

use hickory_resolver::{
    TokioResolver, name_server::TokioConnectionProvider, proto::xfer::Protocol,
};
use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use tracing::info;

use crate::client::dns::FitLauncherDnsConfig;

use hickory_resolver::config::*;
use std::io;

/// A HickoryResolver that defers creation of the actual TokioAsyncResolver.
/// Protocol is determined from the dns config.
#[derive(Debug, Clone)]
pub struct HickoryResolverWithProtocol {
    state: Arc<once_cell::sync::OnceCell<TokioResolver>>,
    dns_config: FitLauncherDnsConfig,
    rng: Option<rand::rngs::SmallRng>,
}

impl HickoryResolverWithProtocol {
    pub fn new(dns_config: FitLauncherDnsConfig) -> Self {
        Self {
            state: Arc::new(once_cell::sync::OnceCell::new()),
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
            let resolver = hickory_resolver
                .state
                .get_or_try_init(|| new_resolver_with_config(&hickory_resolver.dns_config))?;

            let lookup = match resolver.lookup_ip(name.as_str()).await {
                Ok(ip) => ip,
                Err(err) => {
                    eprintln!("Error looking up IPs: {err}");
                    eprintln!("Name of DNS is {:?}", name.as_str());
                    return Err(err.into());
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

/// A generalized function to create a new resolver given a `DnsConfig`.
/// We determine the protocol and primary DNS server, then construct the resolver.
pub fn new_resolver_with_config(dns_config: &FitLauncherDnsConfig) -> io::Result<TokioResolver> {
    // Determine protocol
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
        Ok(socket_addr) => {
            // Successfully parsed a SocketAddr with IP and port
            socket_addr
        }
        Err(_) => {
            // Failed to parse as SocketAddr, assume it's an IP without a port (Probably an IpV4 that's custom because the struct doesn't allow custom ports for UDP)
            let primary_ip: IpAddr = primary_str
                .parse()
                .expect("Invalid primary DNS address in dns.json");
            SocketAddr::new(primary_ip, 53)
        }
    };
    let custom_name_server_config = NameServerConfig::new(custom_socket_vec_addr, protocol);

    let mut custom_resolver_dns_config = ResolverConfig::new();
    custom_resolver_dns_config.add_name_server(custom_name_server_config);

    Ok(TokioResolver::builder_with_config(
        custom_resolver_dns_config,
        TokioConnectionProvider::default(),
    )
    .build())
}
