use std::path::PathBuf;

use fit_launcher_scraping::structs::Game;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::InstallationError;

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
        id: Uuid,
    ) -> Result<(), crate::InstallationError> {
        #[cfg(target_os = "windows")]
        {
            use tracing::info;

            use crate::{
                emitter::setup::progress_bar_setup_emit,
                mighty::automation::win32::{kill_completed_setup, mute_process_audio},
                mighty_automation::{automate_until_download, start_executable_components_args},
                process_utils::find_child_pid_with_retry,
            };

            let setup_executable_path = self.path.join("setup.exe");
            info!("Setup path is: {}", setup_executable_path.to_string_lossy());

            let root_pid = start_executable_components_args(setup_executable_path)?;

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
            info!("Game Installation has been started");

            // Find the child process (setup.temp_setup) that owns the installer window
            // We need to do this because the root setup.exe spawns a child that actually handles the UI
            let installer_pid = find_child_pid_with_retry(root_pid, 10, 200);
            if let Some(pid) = installer_pid {
                info!("Found installer child process with PID: {}", pid);
                mute_process_audio(pid);
            } else {
                info!("Could not find child process, monitoring all processes");
            }
            let success = progress_bar_setup_emit(
                app_handle.clone(),
                self.cancel_emitter.clone(),
                id,
                Some(game_output_folder.clone()),
                installer_pid,
                Some(root_pid),
            )
            .await;

            if success {
                info!("Job has completed!");
                // Note: setup::progress::finished is already emitted by progress_bar_setup_emit
                kill_completed_setup();
                Ok(())
            } else {
                info!("Job was cancelled or timed out.");
                Err(crate::InstallationError::IOError(
                    "Installation cancelled or timed out".to_string(),
                ))
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            info!("Automated setup installation is not supported on this platform");
            return Err(TorrentApiError::IOError(
                "Automated setup installation is not supported on this platform".to_string(),
            ));
        }
    }

    pub async fn clean_parts(&self) -> Result<(), crate::InstallationError> {
        #[cfg(target_os = "windows")]
        {
            use tokio::fs;
            use tracing::info;

            let mut attempts = 0;
            let path = self.path.clone();
            loop {
                match fs::remove_dir_all(path.clone()).await {
                    Ok(_) => return Ok(()),
                    Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied && attempts < 20 => {
                        // Folder still locked by Windows

                        use std::time::Duration;
                        attempts += 1;
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        continue;
                    }
                    Err(e) => return Err(InstallationError::IOError(e.to_string())),
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(())
        }
    }
}
