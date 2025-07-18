use aria2_ws::{Client, Map, TaskOptions};
use serde_json::Value;
use tracing::error;

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
    // Convert to 1-based indices
    let select_file: String = select_file
        .into_iter()
        .map(|idx| (idx + 1).to_string())
        .collect::<Vec<_>>()
        .join(",");

    let mut options = TaskOptions {
        dir,
        r#continue: Some(true),
        extra_options: Map::new(),
        ..TaskOptions::default()
    };

    if !select_file.is_empty() {
        options
            .extra_options
            .insert("select-file".to_string(), Value::String(select_file));
    }

    aria2_client
        .add_torrent(torrent, None, Some(options), None, None)
        .await
        .map_err(|e| {
            error!("Failed to add torrent: {}", e);
            Aria2Error::RPCError(format!("Failed to add torrent: {}", e))
        })
}
