use std::path::Path;

use fit_launcher_ui_automation::auto_installation;

use crate::errors::TorrentApiError;

/// `setup.exe` should be placed inside `dir_path`
pub async fn auto_install_game(dir_path: impl AsRef<Path>) -> Result<(), TorrentApiError> {
    Ok(auto_installation(dir_path.as_ref()).await?)
}
