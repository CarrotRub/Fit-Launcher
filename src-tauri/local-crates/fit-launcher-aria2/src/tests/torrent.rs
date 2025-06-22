#![allow(unused)]
use fit_launcher_torrent::{download_torrent_from_paste, functions::TorrentSession};

use crate::aria2::{aria2_add_torrent, aria2_add_uri};

#[tokio::test]
async fn add_magnet() -> Result<(), Box<dyn std::error::Error>> {
    let session = TorrentSession::new().await;

    let client = session.aria2_client()?;

    let magnet = "magnet:?xt=urn:btih:a492f8b92a25b0399c87715fc228c864ac5a7bfb&dn=archlinux-2025.06.01-x86_64.iso";
    let dir = Some("./downloads".to_string());

    aria2_add_uri(&client, magnet.to_string(), dir, None).await?;

    Ok(())
}

#[tokio::test]
async fn download_magnet() -> Result<(), Box<dyn std::error::Error>> {
    let session = TorrentSession::new().await;
    let client = session.aria2_client()?;

    let magnet = "magnet:?xt=urn:btih:a492f8b92a25b0399c87715fc228c864ac5a7bfb&dn=archlinux-2025.06.01-x86_64.iso";
    let dir = Some("./downloads".to_string());

    let gid = aria2_add_uri(&client, magnet.to_string(), dir.clone(), None).await?;
    println!("Started download with GID: {}", gid);

    let start_time = std::time::Instant::now();
    let duration = std::time::Duration::from_secs(60);

    while start_time.elapsed() < duration {
        let status = client.tell_status(&gid).await?;

        println!(
            "Download Status [{}]:\n\
            - Status: {:?}\n\
            - Progress: {:.2}% ({}/{} bytes)\n\
            - Speed: {}/s\n\
            - Connections: {}\n\
            - Seeds: {}\n\
            - Path: {:#?}
            ",
            gid,
            status.status,
            (status.completed_length as f64 / status.total_length as f64) * 100.0,
            status.completed_length,
            status.total_length,
            status.download_speed as u64,
            status.connections,
            status.num_seeders.unwrap_or(000),
            status.files
        );

        if status.status == aria2_ws::response::TaskStatus::Complete {
            println!("Download completed successfully!");
            return Ok(());
        }

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }

    println!("60 second timeout reached. Download may still be in progress.");
    Ok(())
}

#[tokio::test]
async fn add_torrent() -> Result<(), Box<dyn std::error::Error>> {
    let session = TorrentSession::new().await;

    let client = session.aria2_client()?;

    let torrent = download_torrent_from_paste("https://paste.fitgirl-repacks.site/?9c702e154b3d2a4e#AuZBuL1J8pkVaQKazQvTfbtW1CUUg42F4qqzotnmbp5K".into())
        .await
        .unwrap();
    let dir = Some("./downloads".to_string());
    eprintln!("downloaded torrent!");

    aria2_add_torrent(&client, torrent, dir, vec![]).await?;

    Ok(())
}
