use std::path::PathBuf;

use fit_launcher_scraping::structs::Game;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Clone)]
pub struct InstallationJob {
    pub id: Uuid,
    pub cancel_emitter: CancellationToken,
    pub game: Game,
    pub path: PathBuf,
}

impl InstallationJob {
    pub async fn auto_installation(
        &self,
        app_handle: tauri::AppHandle,
    ) -> Result<(), crate::InstallationError> {
        #[cfg(target_os = "windows")]
        {
            use tracing::info;

            use crate::{
                emitter::setup::progress_bar_setup_emit,
                mighty_automation::windows_ui_automation::{
                    automate_until_download, start_executable_components_args,
                },
            };

            let setup_executable_path = self.path.join("setup.exe");
            info!("Setup path is: {}", setup_executable_path.to_string_lossy());

            start_executable_components_args(setup_executable_path)?;

            let s = self.path.to_string_lossy();
            let lower = s.to_lowercase();
            let tag = " [fitgirl repack]";

            let game_output_folder = if lower.ends_with(tag) {
                let cut_pos = s.len() - tag.len();
                s[..cut_pos].trim_end().to_string()
            } else {
                s.to_string()
            };

            automate_until_download(&game_output_folder).await;

            progress_bar_setup_emit(app_handle, self.cancel_emitter.clone()).await;

            info!("Torrent has completed!");
            info!("Game Installation has been started");

            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            info!("Automated setup installation is not supported on this platform");
            return Err(TorrentApiError::IOError(
                "Automated setup installation is not supported on this platform".to_string(),
            ));
        }
    }
}
