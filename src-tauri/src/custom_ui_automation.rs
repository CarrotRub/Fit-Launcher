mod checklist_automation {
    use uiautomation::{UIAutomation, UIElement};
    use uiautomation::types::UIProperty::{ClassName, NativeWindowHandle, ToggleToggleState};


    fn get_checklistbox() -> Result<UIElement, uiautomation::errors::Error>{
        let automation = UIAutomation::new().unwrap();


        let checklistbox_element = automation.create_matcher().classname("TNewCheckListBox");
    
        
        let sec_elem = checklistbox_element.find_first();
    
        // println!("{:#?}", sec_elem.unwrap());

        sec_elem
    }

    pub fn get_checkboxes_from_list(list_to_check: Vec<String>) {
        let automation = UIAutomation::new().unwrap();
        let walker = automation.get_control_view_walker().unwrap();
    
        let checklistbox_elem = match get_checklistbox() {
            Ok(elem) => elem,
            Err(e) => {
                println!("Failed to find checklist box: {}", e);
                return; // Or handle the error appropriately
            }
        };
    
        if let Ok(child) = walker.get_first_child(&checklistbox_elem) {
            match child {
                ref ch => {
                    process_element(ch.clone(),list_to_check.clone());
                }
            }
    
            let mut next = child;
            while let Ok(sibling) = walker.get_next_sibling(&next) {

                match sibling{
                    ref sib => {
                        process_element(sib.clone(), list_to_check.clone());
                    }
                }
                next = sibling;
            }
        }
    }
    
    fn process_element(element: UIElement, chkbx_to_check: Vec<String>) {
        match element {
            ref el => {
                // Get various properties and patterns as before
                let spec_classname = el.get_property_value(ClassName).unwrap(); // NULL
                let spec_proc_handle = el.get_property_value(NativeWindowHandle).unwrap();
    
                let spec_toggle_toggle_state = el.get_property_value(ToggleToggleState).unwrap(); // NULL
                let spec_control_type = el.get_control_type().unwrap();
    
                let spec_text_inside = el.get_name().unwrap();
                println!(
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
                            Ok(_) => println!("Space key sent to element."),
                            Err(e) => eprintln!("Failed to send space key: {:?}", e),
                        } 
                    } else {
                        println!("skipped : {:#?}",spec_text_inside);
                    }

                });
                

            }
        }
    }

}




pub mod windows_ui_automation {
    use std::process;
    use std::process::Command;
    use std::path::Path;
    use super::checklist_automation;
    use crate::mighty::windows_controls_processes;
    
    pub fn start_executable<P: AsRef<Path> + std::convert::AsRef<std::ffi::OsStr>>(path: P) {
        match Command::new(path)
            .spawn() 
        {
            Ok(mut child) => {
                println!("Executable started with PID: {}", child.id());
            }
            Err(e) => {
                eprintln!("Failed to start executable: {}", e);
    
                // Optionally, you might want to check if the file is being used
                if e.raw_os_error() == Some(32) {
                    eprintln!(" Some Other Process is Creeping on him.")
                }
    
            },
        }
    }

    pub fn open_with_default_application(path: String) -> std::io::Result<()> {
        Command::new("cmd")
            .args([&path])
            .spawn()?
            .wait()?;
        Ok(())
    }
    pub fn automate_until_download(user_checkboxes_to_check: Vec<String>, path_to_game: &str) {

        // Skip Select Setup Language.
        windows_controls_processes::click_ok_button();
        // Skip Select Setup Language.

        // Skip until checkboxes.
        windows_controls_processes::click_8gb_limit();
        windows_controls_processes::click_next_button();
        windows_controls_processes::click_next_button();
        // Skip until checkboxes.

        // Change path input.
        windows_controls_processes::change_path_input(path_to_game);
        windows_controls_processes::click_next_button();
        // Change path input.
        
        // Uncheck (Because they are all checked before hand) the checkboxes given by the user to uncheck.
        checklist_automation::get_checkboxes_from_list(user_checkboxes_to_check);
        // Uncheck (Because they are all checked before hand) the checkboxes given by the user to uncheck.
        
        // Start Installation.
        windows_controls_processes::click_install_button();
        // Start Installation.

        

    }
        // Print and get and send progress bar value every 500ms
}
