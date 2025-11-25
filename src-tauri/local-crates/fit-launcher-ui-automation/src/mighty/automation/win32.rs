use tracing::{error, info};
use windows::Win32::{
    Foundation::{FALSE, HWND, LPARAM, TRUE, WPARAM},
    UI::WindowsAndMessaging::{BM_CLICK, EnumChildWindows, PostMessageW, SendMessageW, WM_SETTEXT},
};
use windows_result::BOOL;

use crate::mighty::{
    retry_until,
    windows::os_windows::{find_child_window_with_text, get_class_name, get_setup_process_title},
};

fn click_button(label: &str, window: &str) -> bool {
    if let Some(hwnd) = retry_until(5000, 50, || find_child_window_with_text(label, window)) {
        unsafe {
            if let Err(e) = PostMessageW(Some(hwnd), BM_CLICK, WPARAM(0), LPARAM(0)) {
                error!("PostMessageW failed for {label}: {e:?}");
                return false;
            }
        }
        return true;
    }

    error!("Timeout finding button: {label}");
    false
}

#[cfg(target_os = "windows")]
pub fn click_ok_button_impl() {
    click_button("OK", "Select Setup Language");
}

pub fn click_8gb_limit_impl() {
    click_button("Limit installer to 2 GB of RAM usage", "Setup -");
}

pub fn click_next_button_impl() {
    click_button("Next >", "Setup -");
}

pub fn click_install_button_impl() {
    click_button("Install", "Setup -");
}

pub fn change_path_input_impl(input_text: &str) {
    let parent_hwnd = get_setup_process_title("Setup -");

    let text_input = retry_until(5000, 50, || {
        let mut found: HWND = HWND(std::ptr::null_mut());

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let out: &mut HWND = unsafe { &mut *(lparam.0 as *mut HWND) };

            // Keep this minimal inside FFI boundary
            if get_class_name(hwnd) == "TEdit" {
                *out = hwnd;
                return FALSE;
            }

            TRUE
        }

        unsafe {
            #[allow(unused_must_use)]
            EnumChildWindows(
                Some(parent_hwnd),
                Some(enum_proc),
                LPARAM(&mut found as *mut _ as isize),
            );
        }

        if !found.0.is_null() {
            Some(found)
        } else {
            None
        }
    });

    let Some(hwnd) = text_input else {
        error!("Failed to find input field.");
        return;
    };

    unsafe {
        let utf16: Vec<u16> = input_text.encode_utf16().chain(Some(0)).collect();

        let _result = SendMessageW(
            hwnd,
            WM_SETTEXT,
            Some(WPARAM(0)),
            Some(LPARAM(utf16.as_ptr() as isize)),
        );

        // WM_SETTEXT does NOT reliably return success/failure
        info!("Set text in the input field.");
    }
}
