//! ALWAYS ADMIN MODE.

use std::time::Duration;

use ::windows::Win32::Foundation::HWND;

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
    let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);

    while std::time::Instant::now() < deadline {
        if let Some(v) = f() {
            return Some(v);
        }

        std::thread::sleep(Duration::from_millis(interval_ms));

        // exponential backoff, capped
        interval_ms = interval_ms.saturating_mul(2).min(500);
    }

    None
}

pub(crate) async fn retry_until_async<F, Fut, T>(
    timeout_ms: u64,
    mut interval_ms: u64,
    mut f: F,
) -> Option<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Option<T>>,
{
    let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);

    while tokio::time::Instant::now() < deadline {
        if let Some(v) = f().await {
            return Some(v);
        }

        tokio::time::sleep(Duration::from_millis(interval_ms)).await;

        // exponential backoff, capped
        interval_ms = (interval_ms * 2).min(500);
    }

    None
}
