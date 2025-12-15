#![allow(unused)]
use std::time::Duration;

use crate::aria2::{aria2_add_torrent, aria2_add_uri};
use fit_launcher_torrent::{
    FitLauncherConfigAria2, decrypt_torrent_from_paste, functions::TorrentSession,
};
use tracing_subscriber::{EnvFilter, fmt};

fn init_test_logging() {
    let _ = fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("fit_launcher_torrent=debug".parse().unwrap())
                .add_directive("aria2_ws=debug".parse().unwrap()),
        )
        .with_test_writer()
        .try_init();
}

#[tokio::test]
async fn add_magnet() -> Result<(), Box<dyn std::error::Error>> {
    let session = TorrentSession::new();

    let client = session.aria2_client().await?;

    let magnet = "magnet:?xt=urn:btih:a492f8b92a25b0399c87715fc228c864ac5a7bfb&dn=archlinux-2025.06.01-x86_64.iso";
    let dir = Some("./downloads".to_string());

    aria2_add_uri(
        &client,
        vec![magnet.to_string()],
        dir,
        None,
        FitLauncherConfigAria2::default(),
    )
    .await?;

    Ok(())
}

#[tokio::test]
async fn add_torrent() -> Result<(), Box<dyn std::error::Error>> {
    init_test_logging();
    let session = TorrentSession::new();
    session.init_client().await;

    tokio::time::sleep(Duration::from_secs(1)).await;

    let client = session.aria2_client().await?;

    let torrent = decrypt_torrent_from_paste("https://paste.fitgirl-repacks.site/?9c702e154b3d2a4e#AuZBuL1J8pkVaQKazQvTfbtW1CUUg42F4qqzotnmbp5K".into())
        .await
        .unwrap();
    let dir = Some("./downloads".to_string());
    eprintln!("downloaded torrent!");

    aria2_add_torrent(&client, torrent, dir, vec![]).await?;

    Ok(())
}
