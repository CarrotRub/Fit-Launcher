use anyhow::anyhow;
use fit_launcher_torrent::{download_torrent_from_paste, list_torrent_files, model::FileInfo};

#[tokio::test(flavor = "multi_thread")]
async fn test_list_torrent_files() -> anyhow::Result<()> {
    let torrent = download_torrent_from_paste(
        "https://paste.fitgirl-repacks.site/?225484ced69df1d1#SKYwGaZwZmRbN2fR4R9QQJzLTmzpctbDE7kZNpwesRW".to_owned(),
    ).await?;
    let parsed = list_torrent_files(torrent)
        .await
        .map_err(|e| anyhow!("{e}"))?;

    assert_eq!(
        parsed[0],
        FileInfo {
            file_name: "fg-01.bin".into(),
            length: 2_823_487_777,
            file_index: 1,
        }
    );
    assert_eq!(
        parsed[2],
        FileInfo {
            file_name: "MD5/fitgirl-bins.md5".into(),
            length: 148,
            file_index: 3,
        }
    );

    Ok(())
}
