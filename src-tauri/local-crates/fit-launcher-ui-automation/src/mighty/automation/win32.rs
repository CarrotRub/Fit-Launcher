use tracing::{debug, error, info};
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::Media::Audio::{
    IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator, ISimpleAudioVolume,
    MMDeviceEnumerator, eMultimedia, eRender,
};
use windows::Win32::System::Com::{
    CLSCTX_ALL, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
};
use windows::Win32::System::Threading::{OpenProcess, PROCESS_TERMINATE, TerminateProcess};
use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;
use windows::Win32::{
    Foundation::{FALSE, HWND, LPARAM, TRUE, WPARAM},
    UI::WindowsAndMessaging::{BM_CLICK, EnumChildWindows, PostMessageW, SendMessageW, WM_SETTEXT},
};
use windows::core::Interface;
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

/// Mutes audio for a specific process ID
pub fn mute_process_audio(pid: u32) -> bool {
    if pid == 0 {
        debug!("Cannot mute audio: PID is 0");
        return false;
    }

    unsafe {
        let com = CoInitializeEx(Some(std::ptr::null_mut()), COINIT_APARTMENTTHREADED);

        if com.is_ok() {
            let device_enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .expect("Error enumerating COM devices");

            let device = device_enumerator
                .GetDefaultAudioEndpoint(eRender, eMultimedia)
                .expect("Error getting the default audio endpoint");

            let session_manager = device
                .Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)
                .expect("Error activing media COM interface");

            let enumerator = session_manager
                .GetSessionEnumerator()
                .expect("Error enumerating audio sessions");

            let count = enumerator
                .GetCount()
                .expect("Error getting count of number of audio sessions");

            for i in 0..count {
                let session = enumerator
                    .GetSession(i)
                    .unwrap_or_else(|_| panic!("Error getting session number {i}"));

                let control: IAudioSessionControl2 = session
                    .cast()
                    .expect("Error casting the IAudioSessionControl into an IAudioSessionControl2");

                if control.GetProcessId().expect("Error getting process ID") == pid {
                    info!("Found audio session for PID {pid}, muting");
                    let volume: ISimpleAudioVolume = session.cast().expect(
                        "Error casting the IAudioSessionControl into an ISimpleAudioVolume",
                    );
                    volume
                        .SetMute(true, std::ptr::null())
                        .expect("Error muting volume of app");
                    return true;
                }
            }

            debug!("No audio session found for PID {pid} (process may not be playing audio yet)");
        } else {
            error!("Error initializing COM devices {:#?}", com.0)
        }
    }
    false
}

/// Legacy function - tries to find setup window and mute it
/// Prefer using mute_process_audio with PID from winevents when available
pub fn mute_setup() {
    let setup_hwnd = get_setup_process_title("Setup -");
    let mut pid = 0u32;
    unsafe {
        GetWindowThreadProcessId(setup_hwnd, Some(&mut pid));
    }
    mute_process_audio(pid);
}

/// Checks if the setup window shows successful completion status.
/// Looks for "Setup has finished installing" text which indicates success.
/// Used as a fallback when no events are received for an extended period.
pub fn find_completed_setup() -> bool {
    if let Some(hwnd) = retry_until(5000, 50, || {
        find_child_window_with_text("Setup has finished installing", "Setup -")
    }) {
        info!("Found completed setup window with HWND: {hwnd:?}");
        true
    } else {
        false
    }
}

pub fn kill_completed_setup() -> bool {
    if let Some(hwnd) = retry_until(5000, 50, || {
        find_child_window_with_text("Setup has finished installing", "Setup -")
    }) {
        info!("Found completed setup window with HWND: {hwnd:?}");
        let mut pid = 0u32;

        unsafe {
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
        }

        if pid == 0 {
            return false;
        }

        kill_process_by_pid(pid)
    } else {
        false
    }
}

/// Kills a process by its PID using TerminateProcess
pub fn kill_process_by_pid(pid: u32) -> bool {
    if pid == 0 {
        debug!("Cannot kill process: PID is 0");
        return false;
    }

    unsafe {
        match OpenProcess(PROCESS_TERMINATE, false, pid) {
            Ok(handle) => {
                if !handle.is_invalid() {
                    let result = TerminateProcess(handle, 1);
                    let _ = CloseHandle(handle);
                    if result.is_ok() {
                        info!("Successfully terminated process with PID: {}", pid);
                        return true;
                    } else {
                        error!("Failed to terminate process with PID: {}", pid);
                    }
                }
            }
            Err(e) => {
                error!("Failed to open process with PID {}: {:?}", pid, e);
            }
        }
    }

    false
}

pub fn click_ok_button_impl() {
    click_button("OK", "Select Setup Language");
}

pub fn mute_setup_impl() {
    mute_setup();
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
