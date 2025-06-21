use aria2_ws::{Client, TaskOptions};

use crate::error::Aria2Error;

pub async fn aria2_add_uri(
    aria2_client: &Client,
    url: String,
    dir: Option<String>,
    filename: Option<String>,
) -> Result<String, Aria2Error> {
    Ok(aria2_client
        .add_uri(
            vec![url],
            Some(TaskOptions {
                split: Some(1),
                out: filename,
                dir,
                r#continue: Some(true),
                ..TaskOptions::default()
            }),
            None,
            None,
        )
        .await?)
}

pub async fn aria2_add_torrent(
    aria2_client: &Client,
    torrent: Vec<u8>,
    dir: Option<String>,
) -> Result<String, Aria2Error> {
    Ok(aria2_client
        .add_torrent(
            torrent,
            None,
            Some(TaskOptions {
                dir,
                r#continue: Some(true),
                ..TaskOptions::default()
            }),
            None,
            None,
        )
        .await?)
}
