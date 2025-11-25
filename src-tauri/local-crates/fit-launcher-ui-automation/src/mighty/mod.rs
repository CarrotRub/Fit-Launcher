//! ALWAYS ADMIN MODE.

use ::windows::Win32::Foundation::HWND;

pub mod automation;
pub mod controls;
pub mod windows;

struct EnumChildWindowsData<'a> {
    search_text: &'a str,
    target_hwnd: *mut HWND,
}

/// Quick helper to retry until with an exponential backoff to avoid infinite loop
pub(crate) fn retry_until<F, T>(timeout_ms: u64, mut interval_ms: u64, mut f: F) -> Option<T>
where
    F: FnMut() -> Option<T>,
{
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);

    while std::time::Instant::now() < deadline {
        if let Some(v) = f() {
            return Some(v);
        }

        std::thread::sleep(std::time::Duration::from_millis(interval_ms));

        // exponential backoff, capped
        interval_ms = interval_ms.saturating_mul(2).min(500);
    }

    None
}
