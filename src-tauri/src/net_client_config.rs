pub mod custom_client_dns {
    use directories::BaseDirs;
    use hickory_resolver::config::*;
    use hickory_resolver::TokioAsyncResolver;
    use once_cell::sync::Lazy;
    use reqwest::ClientBuilder;
    use reqwest::{
        dns::{Addrs, Name, Resolve, Resolving},
        Client,
    };
    use serde::{Deserialize, Serialize};
    use std::fs;
    use std::io;
    use std::io::Write;
    use std::net::{IpAddr, SocketAddr};
    use std::sync::Arc;
    #[derive(Serialize, Deserialize, Debug, Clone)]
    struct DnsConfig {
        protocol: String,
        primary: String,
        secondary: String,
    }

    fn ensure_and_load_dns_config() -> DnsConfig {
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
            let default_config = DnsConfig {
                protocol: "UDP".to_string(),
                primary: "1.1.1.1".to_string(),
                secondary: "1.0.0.1".to_string(),
            };

            let default_config_data = serde_json::to_string_pretty(&default_config)
                .expect("Failed to serialize default DNS config");

            let mut file = fs::File::create(&config_file).expect("Failed to create dns.json file");
            file.write_all(default_config_data.as_bytes())
                .expect("Failed to write to dns.json file");
        }

        let config_data =
            fs::read_to_string(config_file).expect("Failed to read dns.json configuration file");
        let dns_config: DnsConfig = serde_json::from_str(&config_data)
            .expect("Failed to parse dns.json configuration file");

        dns_config
    }

    /// A generalized function to create a new resolver given a `DnsConfig`.
    /// We determine the protocol and primary DNS server, then construct the resolver.
    pub fn new_resolver_with_config(dns_config: &DnsConfig) -> io::Result<TokioAsyncResolver> {
        // Determine protocol
        let protocol = match dns_config.protocol.to_uppercase().as_str() {
            "UDP" => Protocol::Udp,
            "HTTPS" => Protocol::Https,
            other => {
                eprintln!("Unknown protocol in dns.json: {}", other);
                Protocol::Udp
            }
        };

        // Parse the primary DNS address
        let primary_ip: IpAddr = dns_config
            .primary
            .parse()
            .expect("Invalid primary DNS address in dns.json");

        let custom_socket_vec_addr: SocketAddr = SocketAddr::new(primary_ip, 53);

        let custom_name_server_config = NameServerConfig::new(custom_socket_vec_addr, protocol);

        let mut custom_resolver_dns_config = ResolverConfig::new();
        custom_resolver_dns_config.add_name_server(custom_name_server_config);

        let custom_resolver_opts = ResolverOpts::default();

        Ok(TokioAsyncResolver::tokio(
            custom_resolver_dns_config,
            custom_resolver_opts,
        ))
    }

    /// A HickoryResolver that defers creation of the actual TokioAsyncResolver.
    /// Protocol is determined from the dns config.
    #[derive(Debug, Clone)]
    pub struct HickoryResolverWithProtocol {
        state: Arc<once_cell::sync::OnceCell<TokioAsyncResolver>>,
        dns_config: DnsConfig,
        rng: Option<rand::rngs::SmallRng>,
    }

    impl HickoryResolverWithProtocol {
        pub fn new(dns_config: DnsConfig) -> Self {
            Self {
                state: Arc::new(once_cell::sync::OnceCell::new()),
                dns_config,
                rng: None,
            }
        }

        pub fn with_shuffle(mut self, shuffle: bool) -> Self {
            if shuffle {
                use rand::SeedableRng;
                self.rng = Some(rand::rngs::SmallRng::from_entropy());
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

    // Only ONE custom_dns_client, protocol decided by the DnsConfig file found in the
    pub static CUSTOM_DNS_CLIENT: Lazy<Client> = Lazy::new(|| {
        let dns_config = ensure_and_load_dns_config();

        ClientBuilder::new()
            .dns_resolver(Arc::new(HickoryResolverWithProtocol::new(dns_config)))
            .build()
            .expect("Failed to build custom DNS reqwest client")
    });
    // --------------- Thanks to https://github.com/Xuanwo/reqwest-hickory-resolver for the inspiration, would have taken me 3 days or even more without him ! ---------------
}

