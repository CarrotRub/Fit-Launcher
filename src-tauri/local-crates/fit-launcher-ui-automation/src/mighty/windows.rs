//! Only windows and elements finders
#[cfg(target_os = "windows")]
pub mod os_windows {

    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    use tracing::{debug, error, info};
    use windows::Win32::Foundation::*;
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows_result::BOOL;

    use crate::mighty::EnumChildWindowsData;

    pub unsafe extern "system" fn enum_child_windows_proc(hwnd: HWND, l_param: LPARAM) -> BOOL {
        let data = unsafe { &*(l_param.0 as *const EnumChildWindowsData) };
        if let Some(window_text) = get_window_text(hwnd)
            && window_text.contains(data.search_text)
        {
            unsafe { *data.target_hwnd = hwnd };
            return FALSE; // Stop enumeration with special FALSE
        }
        TRUE // Continue enumeration with special TRUE
    }

    struct EnumChildWindowsDataClass<'a> {
        target_hwnd: *mut HWND,
        class_name: &'a str,
    }

    unsafe extern "system" fn enum_child_windows_proc_class(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let data = &*(lparam.0 as *const EnumChildWindowsDataClass);

        let mut buf = [0u16; 256];
        let len = unsafe { GetClassNameW(hwnd, &mut buf) };
        let class_name = String::from_utf16_lossy(&buf[..len as usize]);

        if class_name == data.class_name {
            unsafe { *data.target_hwnd = hwnd };
            return FALSE;
        }

        TRUE
    }

    pub(crate) fn get_window_title(hwnd: HWND) -> Option<String> {
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

    pub(crate) fn get_window_text(hwnd: HWND) -> Option<String> {
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

    pub(crate) fn get_class_name(hwnd: HWND) -> String {
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

    pub(crate) fn get_setup_process_title(proc_title: &str) -> HWND {
        let mut target_hwnd: HWND = HWND(std::ptr::null_mut());

        struct TitleSearchData<'a> {
            title: &'a str,
            target_hwnd: *mut HWND,
        }

        unsafe extern "system" fn enum_windows_callback(hwnd: HWND, l_param: LPARAM) -> BOOL {
            let data = unsafe { &*(l_param.0 as *const TitleSearchData) };
            if let Some(title) = get_window_title(hwnd)
                && title.contains(data.title)
            {
                unsafe {
                    *data.target_hwnd = hwnd;
                }
                return FALSE; // Stop enumeration with special FALSE
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

    pub fn find_child_window_with_text(search_text: &str, proc_title: &str) -> Option<HWND> {
        let parent_hwnd = get_setup_process_title(proc_title);

        let mut target_hwnd: HWND = HWND(std::ptr::null_mut());
        let data = EnumChildWindowsData {
            search_text,
            target_hwnd: &mut target_hwnd,
        };

        unsafe {
            let _ = EnumChildWindows(
                Some(parent_hwnd),
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

    /// Find a Child Window with its classname
    ///
    /// Isn't used at the moment but is necessary for later progress bar percantage acquirement
    pub fn find_child_window_with_classname(classname: &str, proc_title: &str) -> Option<HWND> {
        let parent_hwnd = get_setup_process_title(proc_title);

        if parent_hwnd.0.is_null() {
            error!("[ERROR] Parent window not found for title: {}", proc_title);
            return None;
        }

        let parent_title = get_window_title(parent_hwnd).unwrap_or("<NO TITLE>".into());
        let parent_class = get_class_name(parent_hwnd);

        info!(
            "[INFO] Found parent HWND = {:?} | Title = '{}' | Class = '{}'",
            parent_hwnd, parent_title, parent_class
        );

        let mut target_hwnd: HWND = HWND(std::ptr::null_mut());

        let data = EnumChildWindowsDataClass {
            target_hwnd: &mut target_hwnd,
            class_name: classname,
        };

        unsafe extern "system" fn debug_wrapper(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let data = unsafe { &*(lparam.0 as *const EnumChildWindowsDataClass) };

            let class = get_class_name(hwnd);
            let title = get_window_title(hwnd).unwrap_or_default();

            debug!(
                "[DEBUG] Inspecting child HWND={:?} | Class='{}' | Title='{}'",
                hwnd, class, title
            );

            if class == data.class_name {
                info!("[INFO] MATCH → Found target class: {}", class);
                unsafe { *data.target_hwnd = hwnd };
                return FALSE;
            }

            TRUE
        }

        unsafe {
            EnumChildWindows(
                Some(parent_hwnd),
                Some(debug_wrapper),
                LPARAM(&data as *const _ as isize),
            );
        }

        if !target_hwnd.0.is_null() {
            info!(
                "[INFO] FINAL RESULT: Found child HWND={:?} for Class='{}'",
                target_hwnd, classname
            );
            Some(target_hwnd)
        } else {
            error!(
                "[DEBUG] FINAL RESULT: No child with Class='{}' found.",
                classname
            );
            None
        }
    }
}
