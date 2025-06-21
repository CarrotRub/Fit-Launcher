use aria2_ws::{Client, Map, TaskOptions};
use serde_json::Value;

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
    select_file: impl IntoIterator<Item = usize>,
) -> Result<String, Aria2Error> {
    // empty case is safe, aria2 will treat empty select-file as "*".
    let select_file = select_file
        .into_iter()
        .map(|d| d.to_string())
        .collect::<Vec<String>>()
        .join(",");
    Ok(aria2_client
        .add_torrent(
            torrent,
            None,
            Some(TaskOptions {
                dir,
                r#continue: Some(true),
                extra_options: Map::from_iter(
                    [("select-file".to_string(), Value::String(select_file))].into_iter(),
                ),
                ..TaskOptions::default()
            }),
            None,
            None,
        )
        .await?)
}
