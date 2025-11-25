//! Only windows and elements finders
#[cfg(target_os = "windows")]
pub mod os_windows {

    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    use windows::Win32::Foundation::*;
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows_result::BOOL;

    use crate::mighty::EnumChildWindowsData;

    unsafe extern "system" fn enum_child_windows_proc(hwnd: HWND, l_param: LPARAM) -> BOOL {
        let data = unsafe { &*(l_param.0 as *const EnumChildWindowsData) };
        if let Some(window_text) = get_window_text(hwnd)
            && window_text.contains(data.search_text)
        {
            unsafe { *data.target_hwnd = hwnd };
            return FALSE; // Stop enumeration with special FALSE
        }
        TRUE // Continue enumeration with special TRUE
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
}
