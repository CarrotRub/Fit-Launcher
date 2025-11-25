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
    use crate::mighty::automation::*;
    use fit_launcher_config::commands::get_installation_settings;
    use std::path::PathBuf;
    use std::process::Command;
    use std::{thread, time};
    use tracing::info;

    #[cfg(target_os = "windows")]
    fn is_running_as_admin() -> bool {
        use windows::Win32::{
            Foundation::{CloseHandle, HANDLE},
            Security::{GetTokenInformation, TOKEN_ELEVATION, TOKEN_QUERY, TokenElevation},
            System::Threading::{GetCurrentProcess, OpenProcessToken},
        };

        unsafe {
            let processhandle = GetCurrentProcess();
            let mut tokenhandle = HANDLE(std::ptr::null_mut());
            let desiredaccess = TOKEN_QUERY;
            if OpenProcessToken(processhandle, desiredaccess, &mut tokenhandle as _).is_err() {
                return false;
            }

            let mut tokeninformation = TOKEN_ELEVATION::default();
            let mut needed = 0_u32;

            let result = GetTokenInformation(
                tokenhandle,
                TokenElevation,
                Some(&mut tokeninformation as *mut _ as _),
                size_of::<TOKEN_ELEVATION>() as u32,
                &mut needed as _,
            )
            .map(|_| tokeninformation.TokenIsElevated != 0);

            _ = CloseHandle(tokenhandle);

            result
        }
        .unwrap_or_default()
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
            let args_list = format!("/COMPONENTS=\"{components}\"");

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
        click_ok_button();
        // Skip Select Setup Language.
        let should_two_gb_limit = get_installation_settings().two_gb_limit;
        if should_two_gb_limit {
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
