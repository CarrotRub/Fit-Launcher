//! External service integrations: Debrid services (TorBox, RealDebrid) and credential storage.

pub mod credentials;
pub mod debrid;

pub use debrid::{
    DebridCacheStatus, DebridDirectLink, DebridError, DebridFile, DebridProvider,
    DebridProviderInfo, DebridTorrentInfo, DebridTorrentStatus, TorBoxClient, debrid_add_torrent,
    debrid_check_cache, debrid_delete_torrent, debrid_get_download_link, debrid_get_download_links,
    debrid_get_torrent_info, debrid_get_torrent_status, debrid_list_providers,
};

pub use credentials::{
    CredentialError, CredentialInfo, CredentialStatus, CredentialStore, ManagedStronghold,
    credentials_exists, credentials_get, credentials_init, credentials_list, credentials_remove,
    credentials_status, credentials_store,
};
