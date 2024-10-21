// ! ALWAYS ADMIN MODE.

#[cfg(target_os = "windows")]
pub mod windows_controls_processes {

    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::{thread, time};
    use windows::Win32::Foundation::{BOOL, FALSE, HWND, LPARAM, LRESULT, TRUE, WPARAM};
    use windows::Win32::System::SystemInformation::*;
    use windows::Win32::UI::Controls::{PBM_GETPOS, PBM_GETRANGE};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, EnumWindows, GetClassNameW, GetWindowTextLengthW, GetWindowTextW,
        PostMessageW, SendMessageW, BM_CLICK, WM_SETTEXT,
    };

    fn get_window_title(hwnd: HWND) -> Option<String> {
        unsafe {
            let length = GetWindowTextLengthW(hwnd);
            if length == 0 {
                return None;
            }
            let mut buffer: Vec<u16> = vec![0; length as usize + 1];
            let result = GetWindowTextW(hwnd, &mut buffer);
            if result == 0 {
                return None;
            }
            let os_string = OsString::from_wide(&buffer[..length as usize]);
            Some(os_string.to_string_lossy().into_owned())
        }
    }

    fn get_window_text(hwnd: HWND) -> Option<String> {
        unsafe {
            let length = GetWindowTextLengthW(hwnd);
            if length == 0 {
                return None;
            }
            let mut buffer: Vec<u16> = vec![0; length as usize + 1];
            let result = GetWindowTextW(hwnd, &mut buffer);
            if result == 0 {
                return None;
            }
            let os_string = OsString::from_wide(&buffer[..length as usize]);
            Some(os_string.to_string_lossy().into_owned())
        }
    }

    fn get_class_name(hwnd: HWND) -> String {
        let mut class_name: [u16; 256] = [0; 256];
        unsafe {
            let length = GetClassNameW(hwnd, &mut class_name);
            if length > 0 {
                let raw_class_name = &class_name[..length as usize];
                let class_name_string = String::from_utf16(raw_class_name);
                class_name_string.expect("Weird af dude.")
            } else {
                String::new()
            }
        }
    }

    fn get_setup_process_title(proc_title: &str) -> HWND {
        let mut target_hwnd: HWND = HWND(std::ptr::null_mut());

        struct TitleSearchData<'a> {
            title: &'a str,
            target_hwnd: *mut HWND,
        }

        unsafe extern "system" fn enum_windows_callback(hwnd: HWND, l_param: LPARAM) -> BOOL {
            let data = &*(l_param.0 as *const TitleSearchData);
            if let Some(title) = get_window_title(hwnd) {
                if title.contains(data.title) {
                    unsafe {
                        *data.target_hwnd = hwnd;
                    }
                    return FALSE; // Stop enumeration with special FALSE
                }
            }
            TRUE // Continue enumeration with special TRUE
        }

        let data = TitleSearchData {
            title: proc_title,
            target_hwnd: &mut target_hwnd,
        };

        let _ = unsafe {
            EnumWindows(
                Some(enum_windows_callback),
                LPARAM(&data as *const _ as isize),
            )
        };

        target_hwnd
    }

    struct EnumChildWindowsData<'a> {
        search_text: &'a str,
        target_hwnd: *mut HWND,
    }

    unsafe extern "system" fn enum_child_windows_proc(hwnd: HWND, l_param: LPARAM) -> BOOL {
        let data = &*(l_param.0 as *const EnumChildWindowsData);
        if let Some(window_text) = get_window_text(hwnd) {
            if window_text.contains(data.search_text) {
                unsafe { *data.target_hwnd = hwnd };
                return FALSE; // Stop enumeration with special FALSE
            }
        }
        TRUE // Continue enumeration with special TRUE
    }

    pub fn find_child_window_with_text(search_text: &str, proc_title: &str) -> Option<HWND> {
        let parent_hwnd = get_setup_process_title(proc_title);

        let mut target_hwnd: HWND = HWND(std::ptr::null_mut());
        let data = EnumChildWindowsData {
            search_text,
            target_hwnd: &mut target_hwnd,
        };

        unsafe {
            let _ = EnumChildWindows(
                parent_hwnd,
                Some(enum_child_windows_proc),
                LPARAM(&data as *const _ as isize),
            );
        }

        // Don't use clippy here, I need to check null_pointer not null constant and target_hwnd is a ref to a mut pointer, confusion might happen.
        #[allow(clippy::cmp_null)]
        if target_hwnd.0 != std::ptr::null_mut() {
            Some(target_hwnd)
        } else {
            None
        }
    }

    pub fn click_ok_button() {
        let ok_button_text = "OK";
        let first_window_title = "Select Setup Language";

        loop {
            let ok_button_hwnd = find_child_window_with_text(ok_button_text, first_window_title);

            if let Some(hwnd) = ok_button_hwnd {
                unsafe {
                    let result = PostMessageW(hwnd, BM_CLICK, WPARAM(0), LPARAM(0));

                    if result.is_err() {
                        eprintln!(
                            "PostMessageW failed to send the message. Result  {:#?}",
                            result
                        );
                    } else {
                        // // Wait 5 seconds for the next part of the setup to start
                        // thread::sleep(time::Duration::from_millis(5000));
                        println!("Posted click message to OK button!");
                    }
                }
                break; // Exit the loop once the button is clicked
            } else {
                println!("OK button not found. Retrying in 2 seconds...");
                thread::sleep(time::Duration::from_secs(2)); // Wait 2 seconds before retrying
            }
        }
    }

    /// Function to check the user's ram.
    ///
    /// Will return `true` if the user has 9gb or less and false if they have more.
    ///
    /// Usually used before running the UI automation.
    pub fn check_8gb_limit() -> bool {
        let mut sys: sysinfo::System = sysinfo::System::new_all();

        sys.refresh_all();
        let total_memory = sys.total_memory();

        // Convert to megabytes
        let total_memory_mb = total_memory / 1024;

        // Use 9gB because the sysinfo might round it and better be safe than sorry.
        // No need for an if-else statement.
        total_memory_mb <= 9
    }

    pub fn click_8gb_limit() {
        let limit_button_text = "Limit installer to 2 GB of RAM usage";
        let first_window_title = "Setup -";

        loop {
            let limit_button_hwnd =
                find_child_window_with_text(limit_button_text, first_window_title);

            if let Some(hwnd) = limit_button_hwnd {
                check_limit_button(Some(hwnd));

                break; // Exit the loop once the button is clicked or checked
            } else {
                println!("Limit button not found. Retrying in 2 seconds...");
                thread::sleep(time::Duration::from_secs(2)); // Wait 2 seconds before retrying
            }
        }
    }

    fn check_limit_button(hwnd: Option<HWND>) {
        if let Some(hwnd) = hwnd {
            unsafe {
                let wparam = WPARAM(0);
                let lparam = LPARAM(0);
                let result = PostMessageW(hwnd, BM_CLICK, wparam, lparam);

                if result.is_err() {
                    eprintln!(
                        "PostMessageW failed to send the message. Result  {:#?} ",
                        result
                    );
                } else {
                    println!("Posted click message to Limit button!");
                }
            }
        } else {
            println!("Limit button not found.");
        }
    }

    pub fn click_next_button() {
        let ok_button_text = "Next >";
        let first_window_title = "Setup -";
        let ok_button_hwnd = find_child_window_with_text(ok_button_text, first_window_title);

        if let Some(hwnd) = ok_button_hwnd {
            unsafe {
                let result = PostMessageW(hwnd, BM_CLICK, WPARAM(0), LPARAM(0));

                if result.is_err() {
                    eprintln!(
                        "PostMessageW for Next Button failed to send the message. Result  {:#?} ",
                        result
                    );
                } else {
                    println!("Posted click message to Next button!");
                }
            }
        } else {
            println!("Next button not found.");
        }
    }

    pub fn change_path_input(input_text: &str) {
        let first_window_title = "Setup -";
        let parent_hwnd = get_setup_process_title(first_window_title);

        let mut text_input_hwnd: HWND = HWND(std::ptr::null_mut());

        unsafe extern "system" fn find_text_input_proc(hwnd: HWND, l_param: LPARAM) -> BOOL {
            let text_input_hwnd = l_param.0 as *mut HWND;
            let class_name = get_class_name(hwnd); // Helper function to get the class name of the control

            if class_name == "TEdit" {
                // The class name for text input fields is typically "Edit"
                println!("found it");
                unsafe {
                    *text_input_hwnd = hwnd;
                }
                return FALSE; // Stop enumeration with special FALSE
            }
            TRUE // Continue enumeration with special TRUE
        }

        unsafe {
            let _ = EnumChildWindows(
                parent_hwnd,
                Some(find_text_input_proc),
                LPARAM(&mut text_input_hwnd as *mut _ as isize),
            );
        }

        if text_input_hwnd.0 != std::ptr::null_mut() {
            unsafe {
                println!("{:#?}", input_text);
                let mut text_wide: Vec<u16> = input_text.encode_utf16().collect();
                text_wide.push(0); // Null-terminate the string like in C++ because Rust basic strings do not implement null-terminated strings. Could have used CString.
                let result = SendMessageW(
                    text_input_hwnd,
                    WM_SETTEXT,
                    WPARAM(0),
                    LPARAM(text_wide.as_ptr() as isize),
                );

                if result == LRESULT(0) {
                    eprintln!(
                        "SendMessageW failed to set the text. Error code: {:#?}",
                        result
                    );
                } else {
                    println!("Set text in the input field successfully!");
                }
            }
        } else {
            println!("Text input field not found.");
        }
    }

    pub fn click_install_button() {
        println!("started");
        let install_button_text = "Install";
        let first_window_title = "Setup -";

        loop {
            let install_button_hwnd =
                find_child_window_with_text(install_button_text, first_window_title);

            if let Some(hwnd) = install_button_hwnd {
                unsafe {
                    let result = PostMessageW(hwnd, BM_CLICK, WPARAM(0), LPARAM(0));

                    if result.is_err() {
                        eprintln!("PostMessageW for Install Button failed to send the message. Result  {:#?} ", result);
                    } else {
                        println!("Posted click message to Install button!");
                        break;
                    }
                }
            } else {
                println!("Install button not found. Trying again in 2 seconds...");
                thread::sleep(time::Duration::from_secs(2)); // Wait 2 seconds before retrying
            }
        }
    }

    #[allow(dead_code)]
    pub fn poll_progress_bar_until_complete() -> f64 {
        let first_window_title = "Setup -";
        let parent_hwnd = get_setup_process_title(first_window_title);

        let mut progress_bar_hwnd: HWND = HWND(std::ptr::null_mut());

        unsafe extern "system" fn find_progress_bar_proc(hwnd: HWND, l_param: LPARAM) -> BOOL {
            let text_input_hwnd = l_param.0 as *mut HWND;
            let class_name = get_class_name(hwnd);

            if class_name == "TNewProgressBar" {
                println!("found it");
                unsafe {
                    *text_input_hwnd = hwnd;
                }
                return FALSE;
            }
            TRUE
        }

        unsafe {
            let _ = EnumChildWindows(
                parent_hwnd,
                Some(find_progress_bar_proc),
                LPARAM(&mut progress_bar_hwnd as *mut _ as isize),
            );
        }

        if progress_bar_hwnd.0 != std::ptr::null_mut() {
            let mut final_percentage = 0.1; // Variable to hold the result make it 0.1 to bypass the is_normal()

            unsafe {
                // Get the current value of the progress bar
                let current_value =
                    SendMessageW(progress_bar_hwnd, PBM_GETPOS, WPARAM(0), LPARAM(0)).0 as i32;

                // Get the high and low values of the progress bar range
                let get_high_value =
                    SendMessageW(progress_bar_hwnd, PBM_GETRANGE, WPARAM(0), LPARAM(0));
                let get_low_value =
                    SendMessageW(progress_bar_hwnd, PBM_GETRANGE, WPARAM(1), LPARAM(0));

                let min = get_low_value.0 as i32;
                let max = get_high_value.0 as i32;

                // Calculate the percentage value of the progress bar add 0.1 just in case.
                let percentage =
                    (((current_value - min) as f64 / (max - min) as f64) * 100.0) + 0.1;

                // Print the percentage value and limit it to 2 numbers after the decimal point
                println!("Progress: {:.2}%", percentage);
                final_percentage = percentage;
            }

            final_percentage // Return the stored result after breaking out of the loop
        } else {
            println!("Progress bar not found.");
            0.0 // Return 0.0 if the progress bar was not found
        }
    }
}
