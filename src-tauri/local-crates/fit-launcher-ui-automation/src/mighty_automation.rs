#[cfg(target_os = "windows")]
/// DEPRECATED VERSION
///
/// PLEASE USE start_executable_components_args(path: String, checkboxes_list: &[String]) INSTEAD
#[allow(dead_code)]
mod checklist_automation {
    use tracing::{error, info, warn};

    #[cfg(target_os = "windows")]
    use uiautomation::types::UIProperty::{ClassName, NativeWindowHandle, ToggleToggleState};

    #[cfg(target_os = "windows")]
    use uiautomation::{UIAutomation, UIElement};

    fn get_checklistbox() -> Result<UIElement, uiautomation::errors::Error> {
        let automation = UIAutomation::new().unwrap();

        let checklistbox_element = automation.create_matcher().classname("TNewCheckListBox");

        // println!("{:#?}", sec_elem.unwrap());

        checklistbox_element.find_first()
    }

    #[cfg(target_os = "windows")]
    pub fn get_checkboxes_from_list(list_to_check: Vec<String>) {
        use tracing::warn;

        let automation = UIAutomation::new().unwrap();
        let walker = automation.get_control_view_walker().unwrap();

        let checklistbox_elem = match get_checklistbox() {
            Ok(elem) => elem,
            Err(e) => {
                warn!("Failed to find checklist box: {}", e);
                return;
            }
        };

        if let Ok(child) = walker.get_first_child(&checklistbox_elem) {
            let ch = &child;
            {
                process_element(ch.clone(), list_to_check.clone());
            }

            let mut next = child;
            while let Ok(sibling) = walker.get_next_sibling(&next) {
                let sib = &sibling;
                {
                    process_element(sib.clone(), list_to_check.clone());
                }
                next = sibling;
            }
        }
    }

    fn process_element(element: UIElement, chkbx_to_check: Vec<String>) {
        let el = &element;
        {
            // Get various properties and patterns as before
            let spec_classname = el.get_property_value(ClassName).unwrap(); // NULL
            let spec_proc_handle = el.get_property_value(NativeWindowHandle).unwrap();

            let spec_toggle_toggle_state = el.get_property_value(ToggleToggleState).unwrap(); // NULL
            let spec_control_type = el.get_control_type().unwrap();

            let spec_text_inside = el.get_name().unwrap();
            info!(
                "ClassName = {:#?} and HWND = {:#?} and ControlType = {:#?} and TTState = {:#?} and CheckboxText = {:#?}",
                spec_classname.to_string(),
                spec_proc_handle.to_string(),
                spec_control_type.to_string(),
                spec_toggle_toggle_state.to_string(),
                spec_text_inside
            );

            chkbx_to_check.iter().for_each(|chkbx| {
                if spec_text_inside.contains(chkbx) {
                    match el.send_keys(" ", 0) {
                        Ok(_) => info!("Space key sent to element."),
                        Err(e) => error!("Failed to send space key: {:?}", e),
                    }
                    match el.send_keys(" ", 0) {
                        Ok(_) => info!("Space key sent to element."),
                        Err(e) => error!("Failed to send space key: {:?}", e),
                    }
                } else {
                    warn!("skipped : {:#?}", spec_text_inside);
                }
            });
        }
    }
}

#[cfg(target_os = "windows")]
pub mod windows_ui_automation {
    use crate::InstallationError;
    use crate::mighty::windows_controls_processes;
    use fit_launcher_config::commands::get_installation_settings;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::{thread, time};
    use tracing::{error, info};

    #[allow(dead_code)]
    #[deprecated(note = "please use `start_executable_components_args` instead")]
    /// DEPRECATED VERSION OF THE START_EXECUTABLE.
    ///
    /// PLEASE USE start_executable_components_args(path: String, checkboxes_list: &\[String]) INSTEAD.
    pub async fn start_executable<P: AsRef<Path> + std::convert::AsRef<std::ffi::OsStr>>(path: P) {
        match Command::new(path).spawn() {
            Ok(child) => {
                info!("Executable started with PID: {}", child.id());
            }
            Err(e) => {
                error!("Failed to start executable: {}", e);

                // Optionally, you might want to check if the file is being used
                if e.raw_os_error() == Some(32) {
                    error!(" Some Other Process is Creeping on him.")
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    fn is_running_as_admin() -> bool {
        unsafe {
            use windows::Win32::Security::{
                AllocateAndInitializeSid, CheckTokenMembership, FreeSid, PSID,
                SECURITY_NT_AUTHORITY, WinBuiltinAdministratorsSid,
            };
            use windows_result::BOOL;

            let mut admin_sid: PSID = PSID::default();

            let result = AllocateAndInitializeSid(
                &SECURITY_NT_AUTHORITY,
                2,
                WinBuiltinAdministratorsSid.0 as u32,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                &mut admin_sid,
            );

            if result.is_err() {
                return false;
            }

            let mut is_member: BOOL = BOOL(0);
            let success = CheckTokenMembership(None, admin_sid, &mut is_member);

            FreeSid(admin_sid);

            success.is_ok() && is_member.as_bool()
        }
    }

    //TODO: Add one for specifical VERY_SILENT mode but only for no 2gb limit and nothing specifical.

    /// Start an executable using tauri::command and gets the components that needs to be checked.
    ///
    pub fn start_executable_components_args(path: PathBuf) -> Result<(), InstallationError> {
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
            let args_list = format!("/COMPONENTS=\"{}\"", components);

            let temp_path = path.with_extension("temp_setup.exe");

            std::fs::copy(&path, &temp_path)
                .map_err(|e| InstallationError::IOError(e.to_string()))?;

            Command::new(&temp_path)
                .arg(args_list)
                .spawn()
                .map_err(|e| InstallationError::IOError(e.to_string()))?;

            info!("Executable started successfully.");
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub async fn automate_until_download(path_to_game: &str) {
        // Skip Select Setup Language.
        windows_controls_processes::click_ok_button();
        // Skip Select Setup Language.
        let should_two_gb_limit = get_installation_settings().two_gb_limit;
        if should_two_gb_limit {
            // Skip until checkboxes.
            thread::sleep(time::Duration::from_millis(1000));
            windows_controls_processes::click_8gb_limit();
            thread::sleep(time::Duration::from_millis(200));
            windows_controls_processes::click_next_button();
            windows_controls_processes::click_next_button();
            // Skip until checkboxes.
            // Change path input, important for both cases.
            windows_controls_processes::change_path_input(path_to_game);
            windows_controls_processes::click_next_button();
            // Change path input, important for both cases.
            // Start Installation.
            windows_controls_processes::click_install_button();
            // Start Installation.
        } else if !should_two_gb_limit && !windows_controls_processes::check_8gb_limit() {
            thread::sleep(time::Duration::from_millis(1000));
            windows_controls_processes::click_next_button();
            windows_controls_processes::click_next_button();
            // Change path input, important for both cases.
            windows_controls_processes::change_path_input(path_to_game);
            windows_controls_processes::click_next_button();
            // Change path input, important for both cases.
            // Start Installation.
            windows_controls_processes::click_install_button();
            // Start Installation.
        } else if !should_two_gb_limit && windows_controls_processes::check_8gb_limit() {
            // Skip until checkboxes.
            thread::sleep(time::Duration::from_millis(1000));
            windows_controls_processes::click_8gb_limit();
            thread::sleep(time::Duration::from_millis(200));
            windows_controls_processes::click_next_button();
            windows_controls_processes::click_next_button();
            // Skip until checkboxes.
            // Change path input, important for both cases.
            windows_controls_processes::change_path_input(path_to_game);
            windows_controls_processes::click_next_button();
            // Change path input, important for both cases.
            // Start Installation.
            windows_controls_processes::click_install_button();
            // Start Installation.
        }

        // * No need for this anymore since we can contact the components directly through commandline.
        // My stupid self forgor that this was still usable :(
        // // Uncheck (Because they are all checked before hand) the checkboxes given by the user to uncheck.
        // thread::sleep(time::Duration::from_millis(1000));
        // checklist_automation::get_checkboxes_from_list(user_checkboxes_to_check);
        // thread::sleep(time::Duration::from_millis(1000));
        // // Uncheck (Because they are all checked before hand) the checkboxes given by the user to uncheck.
    }
    // Print and get and send progress bar value every 500ms
}

pub mod linux_ui_automation {

    /// This function will start an executable using Wine.
    ///
    ///  This function is specific to Arch Linux + X11
    ///
    /// Note that this will work on SteamDeck OS 3.0
    ///
    #[allow(unused)]
    pub fn start_executable_arch_x11() {
        // TODO: Ask for Wine to be installed either through the AUR or to be installed through Flatpak if a steamdeck is used
        // TODO: Ask it through notification after launching the launcher.
        todo!()
    }
}
