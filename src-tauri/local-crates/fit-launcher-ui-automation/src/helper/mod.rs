use std::path::Path;
use tracing::info;

pub async fn auto_installation(path: &Path) -> Result<(), crate::InstallationError> {
    #[cfg(target_os = "windows")]
    {
        use crate::mighty_automation::windows_ui_automation::{
            automate_until_download, start_executable_components_args,
        };

        let setup_executable_path = path.join("setup.exe");
        info!("Setup path is: {}", setup_executable_path.to_string_lossy());

        start_executable_components_args(setup_executable_path)?;

        let s = path.to_string_lossy();
        let lower = s.to_lowercase();
        let tag = " [fitgirl repack]";

        let game_output_folder = if lower.ends_with(tag) {
            let cut_pos = s.len() - tag.len();
            s[..cut_pos].trim_end().to_string()
        } else {
            s.to_string()
        };

        automate_until_download(&game_output_folder).await;

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
