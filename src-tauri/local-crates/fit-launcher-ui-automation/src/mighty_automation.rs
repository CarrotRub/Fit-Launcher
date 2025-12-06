use crate::InstallationError;
use crate::mighty::automation::*;
use fit_launcher_config::commands::get_installation_settings;
use std::path::PathBuf;
use std::process::Command;
use std::{thread, time};
use tracing::info;

#[cfg(target_os = "windows")]
use crate::process_utils::is_running_as_admin;

//TODO: Add one for specifical VERY_SILENT mode but only for no 2gb limit and nothing specifical.

/// Start an executable and return its PID for process tree tracking.
pub fn start_executable_components_args(path: PathBuf) -> Result<u32, InstallationError> {
    #[cfg(target_os = "windows")]
    {
        if !is_running_as_admin() {
            return Err(InstallationError::AdminModeError);
        }

        let installation_settings = get_installation_settings();
        let mut checkboxes_list: Vec<String> = Vec::new();

        if installation_settings.directx_install {
            checkboxes_list.push("directx".to_string());
        }
        if installation_settings.microsoftcpp_install {
            checkboxes_list.push("microsoft".to_string());
        }
        let components = checkboxes_list.join(",");
        let args_list = format!("/COMPONENTS=\"{components}\"");

        let temp_path = path.with_extension("temp_setup.exe");

        std::fs::copy(&path, &temp_path).map_err(|e| InstallationError::IOError(e.to_string()))?;

        let child = Command::new(&temp_path)
            .arg(args_list)
            .spawn()
            .map_err(|e| InstallationError::IOError(e.to_string()))?;

        let pid = child.id();
        info!("Executable started with PID: {}", pid);

        Ok(pid)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(InstallationError::IOError(
            "Not supported on this platform".to_string(),
        ))
    }
}

#[cfg(target_os = "windows")]
pub async fn automate_until_download(path_to_game: &str) {
    // Skip Select Setup Language.

    click_ok_button();
    // Skip Select Setup Language.
    thread::sleep(time::Duration::from_millis(1000));
    mute_setup();
    let should_two_gb_limit = get_installation_settings().two_gb_limit;
    if should_two_gb_limit {
        // mute song by default
        thread::sleep(time::Duration::from_millis(1000));
        // Skip until checkboxes.
        thread::sleep(time::Duration::from_millis(1000));
        click_8gb_limit();
        thread::sleep(time::Duration::from_millis(200));
        click_next_button();
        click_next_button();
        // Skip until checkboxes.
        // Change path input, important for both cases.
        change_path_input(path_to_game);
        click_next_button();
        // Change path input, important for both cases.
        // Start Installation.
        click_install_button();
        // Start Installation.
    } else if !should_two_gb_limit && !check_8gb_limit() {
        thread::sleep(time::Duration::from_millis(1000));
        click_next_button();
        click_next_button();
        // Change path input, important for both cases.
        info!("Path input will be: {}", path_to_game);
        change_path_input(path_to_game);
        click_next_button();
        // Change path input, important for both cases.
        // Start Installation.
        click_install_button();
        // Start Installation.
    } else if !should_two_gb_limit && check_8gb_limit() {
        // Skip until checkboxes.
        thread::sleep(time::Duration::from_millis(1000));
        click_8gb_limit();
        thread::sleep(time::Duration::from_millis(200));
        click_next_button();
        click_next_button();
        // Skip until checkboxes.
        // Change path input, important for both cases.
        change_path_input(path_to_game);
        click_next_button();
        // Change path input, important for both cases.
        // Start Installation.
        click_install_button();
        // Start Installation.
    }

    thread::sleep(time::Duration::from_millis(1000));

    // * No need for this anymore since we can contact the components directly through commandline.
    // My stupid self forgor that this was still usable :(
    // // Uncheck (Because they are all checked before hand) the checkboxes given by the user to uncheck.
    // thread::sleep(time::Duration::from_millis(1000));
    // checklist_automation::get_checkboxes_from_list(user_checkboxes_to_check);
    // thread::sleep(time::Duration::from_millis(1000));
    // // Uncheck (Because they are all checked before hand) the checkboxes given by the user to uncheck.
}

/// This function will start an executable using Wine.
///
///  This function is specific to Arch Linux + X11
///
/// Note that this will work on SteamDeck OS 3.0
///
#[allow(unused)]
#[cfg(not(target_os = "windows"))]
pub fn start_executable_arch_x11() {
    // TODO: Ask for Wine to be installed either through the AUR or to be installed through Flatpak if a steamdeck is used
    // TODO: Ask it through notification after launching the launcher.
    todo!()
}
