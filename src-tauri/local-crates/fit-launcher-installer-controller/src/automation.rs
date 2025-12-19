//! UI automation functions for interacting with the installer.

use std::time::Duration;

use tracing::{debug, error, info};
use windows::Win32::Foundation::{CloseHandle, FALSE, HWND, LPARAM, TRUE, WPARAM};
use windows::Win32::System::Threading::{OpenProcess, PROCESS_TERMINATE, TerminateProcess};
use windows::Win32::UI::WindowsAndMessaging::{
    BM_CLICK, EnumChildWindows, EnumWindows, GetClassNameW, GetWindowTextW, PostMessageW,
    SC_MINIMIZE, SendMessageW, WM_SETTEXT, WM_SYSCOMMAND,
};
use windows_result::BOOL;

use crate::utils::encode_utf16le_with_null;

const RETRY_TIMEOUT_MS: u64 = 5000;
const RETRY_INTERVAL_MS: u64 = 50;
const SETUP_WINDOW_PREFIX: &str = "Setup -";
const LANGUAGE_WINDOW: &str = "Select Setup Language";

fn retry_until<F, T>(timeout_ms: u64, mut interval_ms: u64, mut f: F) -> Option<T>
where
    F: FnMut() -> Option<T>,
{
    let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);

    while std::time::Instant::now() < deadline {
        if let Some(v) = f() {
            return Some(v);
        }

        std::thread::sleep(Duration::from_millis(interval_ms));
        interval_ms = interval_ms.saturating_mul(2).min(500);
    }

    None
}

pub fn window_with_title(title_prefix: &str) -> Option<HWND> {
    struct EnumData {
        prefix: String,
        result: Option<HWND>,
    }

    unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let data = &mut *(lparam.0 as *mut EnumData);

            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buf);

            if len > 0 {
                let title = String::from_utf16_lossy(&buf[..len as usize]);
                if title.starts_with(&data.prefix) {
                    data.result = Some(hwnd);
                    return FALSE;
                }
            }

            TRUE
        }
    }

    let mut data = EnumData {
        prefix: title_prefix.to_string(),
        result: None,
    };

    unsafe {
        let _ = EnumWindows(Some(enum_callback), LPARAM(&mut data as *mut _ as isize));
    }

    data.result
}

fn class_name(hwnd: HWND) -> String {
    let mut buf = [0u16; 256];
    let len = unsafe { GetClassNameW(hwnd, &mut buf) };

    if len > 0 {
        String::from_utf16_lossy(&buf[..len as usize])
    } else {
        String::new()
    }
}

fn window_text(hwnd: HWND) -> String {
    let mut buf = [0u16; 512];
    let len = unsafe { GetWindowTextW(hwnd, &mut buf) };

    if len > 0 {
        String::from_utf16_lossy(&buf[..len as usize])
    } else {
        String::new()
    }
}

fn child_with_text(parent: HWND, text: &str) -> Option<HWND> {
    struct EnumData {
        search_text: String,
        result: Option<HWND>,
    }

    unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let data = &mut *(lparam.0 as *mut EnumData);

            let title = window_text(hwnd);
            if title.contains(&data.search_text) {
                data.result = Some(hwnd);
                return FALSE;
            }

            TRUE
        }
    }

    let mut data = EnumData {
        search_text: text.to_string(),
        result: None,
    };

    unsafe {
        let _ = EnumChildWindows(
            Some(parent),
            Some(enum_callback),
            LPARAM(&mut data as *mut _ as isize),
        );
    }

    data.result
}

fn button(button_text: &str, window_prefix: &str) -> Option<HWND> {
    let parent = window_with_title(window_prefix)?;
    child_with_text(parent, button_text)
}

fn click(label: &str, window_prefix: &str) -> bool {
    if let Some(hwnd) = retry_until(RETRY_TIMEOUT_MS, RETRY_INTERVAL_MS, || {
        button(label, window_prefix)
    }) {
        unsafe {
            if let Err(e) = PostMessageW(Some(hwnd), BM_CLICK, WPARAM(0), LPARAM(0)) {
                error!("PostMessageW failed for '{}': {:?}", label, e);
                return false;
            }
        }
        debug!("Clicked button: {}", label);
        return true;
    }

    error!("Timeout finding button: {}", label);
    false
}

pub fn click_ok() {
    click("OK", LANGUAGE_WINDOW);
}

pub fn minimize_setup() {
    let Some(hwnd) = retry_until(RETRY_TIMEOUT_MS, RETRY_INTERVAL_MS, || {
        window_with_title(SETUP_WINDOW_PREFIX)
    }) else {
        error!("failed to find window hwnd of setup");
        return;
    };
    unsafe {
        if let Err(e) = PostMessageW(
            Some(hwnd),
            WM_SYSCOMMAND,
            WPARAM(SC_MINIMIZE as _),
            LPARAM(0),
        ) {
            error!("PostMessageW failed with {e}");
        }
    }
}

pub fn click_next() {
    click("Next >", SETUP_WINDOW_PREFIX);
}

pub fn click_install() {
    click("Install", SETUP_WINDOW_PREFIX);
}

pub fn toggle_ram_limit() {
    click("Limit installer to 2 GB of RAM usage", SETUP_WINDOW_PREFIX);
}

pub fn set_install_path(path: &str) {
    let parent = match window_with_title(SETUP_WINDOW_PREFIX) {
        Some(h) => h,
        None => {
            error!("Could not find setup window");
            return;
        }
    };

    let edit = retry_until(RETRY_TIMEOUT_MS, RETRY_INTERVAL_MS, || {
        struct EnumData {
            result: Option<HWND>,
        }

        unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
            unsafe {
                let data = &mut *(lparam.0 as *mut EnumData);

                if class_name(hwnd) == "TEdit" {
                    data.result = Some(hwnd);
                    return FALSE;
                }

                TRUE
            }
        }

        let mut data = EnumData { result: None };
        unsafe {
            let _ = EnumChildWindows(
                Some(parent),
                Some(enum_callback),
                LPARAM(&mut data as *mut _ as isize),
            );
        }
        data.result
    });

    let Some(hwnd) = edit else {
        error!("Failed to find path input field");
        return;
    };

    unsafe {
        let utf16: Vec<u16> = encode_utf16le_with_null(path);
        let _ = SendMessageW(
            hwnd,
            WM_SETTEXT,
            Some(WPARAM(0)),
            Some(LPARAM(utf16.as_ptr() as isize)),
        );
    }

    info!("Set install path to: {}", path);
}

pub fn needs_ram_limit() -> bool {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_all();
    let total_mb = sys.total_memory() / 1024;
    total_mb <= 9
}

/// Mute audio for a specific process using the winmix crate.
///
/// Uses WinMix to enumerate audio sessions and mute the one matching the given PID.
pub fn mute_process_audio(pid: u32) {
    if pid == 0 {
        return;
    }

    info!("Attempting to mute audio for PID {}", pid);

    unsafe {
        let winmix = winmix::WinMix::default();

        match winmix.enumerate() {
            Ok(sessions) => {
                for session in sessions {
                    if session.pid == pid {
                        info!("Found audio session for PID {}, muting...", pid);
                        if let Err(e) = session.vol.set_mute(true) {
                            error!("Failed to mute PID {}: {:?}", pid, e);
                        } else {
                            info!("Successfully muted audio for PID {}", pid);
                        }
                        return;
                    }
                }
                info!(
                    "No audio session found for PID {} (may not have audio yet)",
                    pid
                );
            }
            Err(e) => {
                error!("Failed to enumerate audio sessions: {:?}", e);
            }
        }
    }
}

pub fn kill_process(pid: u32) {
    if pid == 0 {
        return;
    }

    unsafe {
        if let Ok(handle) = OpenProcess(PROCESS_TERMINATE, false, pid)
            && !handle.is_invalid()
        {
            if TerminateProcess(handle, 1).is_ok() {
                info!("Terminated process PID {}", pid);
            }
            let _ = CloseHandle(handle);
        }
    }
}

pub fn completed_setup() -> bool {
    retry_until(RETRY_TIMEOUT_MS, RETRY_INTERVAL_MS, || {
        let parent = window_with_title(SETUP_WINDOW_PREFIX)?;
        child_with_text(parent, "Setup has finished installing")
    })
    .is_some()
}
