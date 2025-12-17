//! Error capture utilities for extracting error messages from installer windows.

use tracing::info;
use windows::Win32::Foundation::{FALSE, HWND, LPARAM, TRUE};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumChildWindows, EnumWindows, GetClassNameW, GetWindowTextW,
};
use windows_result::BOOL;

/// Window title patterns that indicate an error dialog.
/// These appear as separate popup windows, not inside the main Setup window.
/// ISDone.dll is the FitGirl repack installer's error dialog.
const ERROR_WINDOW_TITLES: &[&str] = &["ISDone.dll"];

/// Capture error text from an error popup window.
///
/// Looks for separate error dialog windows (not inside the main Setup window)
/// and extracts text from their label controls.
pub fn capture_error_text() -> Option<String> {
    // Look for error dialog windows by title
    for title in ERROR_WINDOW_TITLES {
        if let Some(hwnd) = find_window_by_title(title) {
            info!("Found error window: '{}'", title);
            let texts = collect_label_texts(hwnd);
            info!("Collected {} text labels from error window", texts.len());

            if !texts.is_empty() {
                // Combine all label texts, filter out button-like ones
                let error_text: Vec<_> = texts
                    .into_iter()
                    .filter(|t| t.len() > 3 && !is_button_text(t))
                    .collect();

                if !error_text.is_empty() {
                    let combined = error_text.join("\n");
                    // Clean up FitGirl installer placeholders
                    let cleaned = combined.replace("%n", "\n");
                    info!("Captured error from '{}' window: {}", title, cleaned);
                    return Some(cleaned);
                }
            }
        }
    }

    None
}

/// Check if text looks like a button label (ISDone.dll button texts).
fn is_button_text(text: &str) -> bool {
    matches!(text.to_lowercase().as_str(), "ok" | "cancel" | "browse...")
}

/// Find a window by exact title match.
fn find_window_by_title(title: &str) -> Option<HWND> {
    struct EnumData {
        target: String,
        result: Option<HWND>,
    }

    unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let data = &mut *(lparam.0 as *mut EnumData);
            let text = window_text(hwnd);

            if text == data.target {
                data.result = Some(hwnd);
                return FALSE; // Stop enumeration
            }

            TRUE // Continue
        }
    }

    let mut data = EnumData {
        target: title.to_string(),
        result: None,
    };

    unsafe {
        let _ = EnumWindows(Some(enum_callback), LPARAM(&mut data as *mut _ as isize));
    }

    data.result
}

/// Collect text from all label/static child controls in a window.
fn collect_label_texts(parent: HWND) -> Vec<String> {
    struct EnumData {
        texts: Vec<String>,
    }

    unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let data = &mut *(lparam.0 as *mut EnumData);
            let class = class_name(hwnd);

            // TLabel/TNewStaticText used by Inno Setup, Static for standard Windows
            if class == "TLabel" || class == "Static" || class == "TNewStaticText" {
                let text = window_text(hwnd);
                if !text.is_empty() {
                    data.texts.push(text);
                }
            }

            TRUE // Continue enumeration
        }
    }

    let mut data = EnumData { texts: Vec::new() };
    unsafe {
        let _ = EnumChildWindows(
            Some(parent),
            Some(enum_callback),
            LPARAM(&mut data as *mut _ as isize),
        );
    }

    data.texts
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
    let mut buf = [0u16; 1024];
    let len = unsafe { GetWindowTextW(hwnd, &mut buf) };

    if len > 0 {
        String::from_utf16_lossy(&buf[..len as usize])
    } else {
        String::new()
    }
}
