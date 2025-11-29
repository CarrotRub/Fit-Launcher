use std::{collections::HashMap, path::PathBuf};

use specta::specta;
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;
use tracing::info;

use crate::{emitter::setup::progress_bar_setup_emit, errors::ExtractError, extract_archive};
