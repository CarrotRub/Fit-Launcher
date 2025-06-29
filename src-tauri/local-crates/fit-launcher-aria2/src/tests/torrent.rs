// #![allow(unused)]
// use fit_launcher_torrent::{download_torrent_from_paste, functions::TorrentSession};

// use crate::aria2::{aria2_add_torrent, aria2_add_uri};

// #[tokio::test]
// async fn add_magnet() -> Result<(), Box<dyn std::error::Error>> {
//     let session = TorrentSession::new().await;

//     let client = session.aria2_client()?;

//     let magnet = "magnet:?xt=urn:btih:a492f8b92a25b0399c87715fc228c864ac5a7bfb&dn=archlinux-2025.06.01-x86_64.iso";
//     let dir = Some("./downloads".to_string());

//     aria2_add_uri(&client, magnet.to_string(), dir, None).await?;

//     Ok(())
// }

// #[tokio::test]
// async fn add_torrent() -> Result<(), Box<dyn std::error::Error>> {
//     let session = TorrentSession::new().await;

//     let client = session.aria2_client()?;

//     let torrent = download_torrent_from_paste("https://paste.fitgirl-repacks.site/?9c702e154b3d2a4e#AuZBuL1J8pkVaQKazQvTfbtW1CUUg42F4qqzotnmbp5K".into())
//         .await
//         .unwrap();
//     let dir = Some("./downloads".to_string());
//     eprintln!("downloaded torrent!");

//     aria2_add_torrent(&client, torrent, dir, vec![]).await?;

//     Ok(())
// }
