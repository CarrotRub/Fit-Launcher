use tracing::{debug, error, info, warn};
use windows::Win32::Media::Audio::{
    IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator, ISimpleAudioVolume,
    MMDeviceEnumerator, eMultimedia, eRender,
};
use windows::Win32::System::Com::{
    CLSCTX_ALL, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
};
use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextW, GetWindowThreadProcessId};
use windows::Win32::{
    Foundation::{FALSE, HWND, LPARAM, TRUE, WPARAM},
    UI::WindowsAndMessaging::{BM_CLICK, EnumChildWindows, PostMessageW, SendMessageW, WM_SETTEXT},
};
use windows::core::Interface;
use windows_result::BOOL;

use crate::mighty::windows::os_windows::find_app_with_classname_and_title;
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

pub fn mute_setup() {
    let setup_hwnd = get_setup_process_title("Setup -");

    let mut pid = 0u32;

    unsafe {
        GetWindowThreadProcessId(setup_hwnd, Some(&mut pid));
    }

    info!("Process ID is: {pid}");
    unsafe {
        // init COM
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
                    info!("Found correct process id: {pid}");
                    let volume: ISimpleAudioVolume = session.cast().expect(
                        "Error casting the IAudioSessionControl into an ISimpleAudioVolume",
                    );
                    volume
                        .SetMute(true, std::ptr::null())
                        .expect("Error muting volume of app");
                    break;
                }
                error!("No process ID related to the Setup was found");
            }
        } else {
            error!("Error initializing COM devices {:#?}", com.0)
        }
    }
}

pub fn poll_progress_bar_percentage() -> Option<f32> {
    if let Some(hwnd) = find_app_with_classname_and_title("TApplication", "%") {
        if hwnd.0.is_null() {
            return None;
        }

        let mut buf = [0u16; 256];

        unsafe {
            let len = GetWindowTextW(hwnd, &mut buf);

            if len <= 0 {
                return None;
            }

            let title = String::from_utf16_lossy(&buf[..len as usize]);

            match parse_percentage(&title) {
                Some(p) => {
                    debug!("Progress: {}%", p);
                    Some(p)
                }
                None => {
                    warn!("Failed to parse percentage from title: {}", title);
                    None
                }
            }
        }
    } else {
        None
    }
}

fn parse_percentage(text: &str) -> Option<f32> {
    let percent_pos = text.find('%')?;

    let before = text[..percent_pos].trim();

    let number_start = before
        .rfind(|c: char| !c.is_ascii_digit() && c != '.')
        .map(|i| i + 1)
        .unwrap_or(0);

    let number_str = &before[number_start..];

    let float_val: f32 = number_str.parse().ok()?;
    Some(float_val)
}

pub async fn poll_loop_async() {
    loop {
        if let Some(progress) = poll_progress_bar_percentage() {
            debug!("Progress: {}%", progress);

            if progress >= 100.0 {
                break;
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
    }
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
