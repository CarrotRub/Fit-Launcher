//! Process utilities for finding child processes using sysinfo.

use sysinfo::{Pid, ProcessesToUpdate, System};
use tracing::debug;

/// Find the first child process of a given parent PID.
/// Returns None if no child is found.
pub fn find_child_pid(parent_pid: u32) -> Option<u32> {
    let mut sys = System::new();
    // Refresh all processes to populate the process list
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let parent = Pid::from_u32(parent_pid);

    sys.processes()
        .values()
        .find(|p| p.parent() == Some(parent))
        .map(|p| p.pid().as_u32())
}

/// Find a child process of the given parent, retrying up to max_attempts times.
/// Waits wait_ms milliseconds between attempts.
pub fn find_child_pid_with_retry(parent_pid: u32, max_attempts: u32, wait_ms: u64) -> Option<u32> {
    for attempt in 1..=max_attempts {
        if let Some(child) = find_child_pid(parent_pid) {
            debug!(
                "Found child PID {} for parent {} on attempt {}",
                child, parent_pid, attempt
            );
            return Some(child);
        }
        std::thread::sleep(std::time::Duration::from_millis(wait_ms));
    }
    None
}

/// Check if a PID is a descendant (child, grandchild, etc.) of an ancestor PID.
pub fn is_descendant_of(pid: u32, ancestor_pid: u32) -> bool {
    let mut sys = System::new();
    // Refresh all processes to populate the process list
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let mut current = Pid::from_u32(pid);
    let ancestor = Pid::from_u32(ancestor_pid);

    // Walk up the parent chain
    for _ in 0..10 {
        if let Some(process) = sys.process(current) {
            if let Some(parent) = process.parent() {
                if parent == ancestor {
                    return true;
                }
                current = parent;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    false
}

#[cfg(target_os = "windows")]
pub fn is_running_as_admin() -> bool {
    use windows::Win32::{
        Foundation::{CloseHandle, HANDLE},
        Security::{GetTokenInformation, TOKEN_ELEVATION, TOKEN_QUERY, TokenElevation},
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };

    unsafe {
        let processhandle = GetCurrentProcess();
        let mut tokenhandle = HANDLE(std::ptr::null_mut());
        let desiredaccess = TOKEN_QUERY;
        if OpenProcessToken(processhandle, desiredaccess, &mut tokenhandle as _).is_err() {
            return false;
        }

        let mut tokeninformation = TOKEN_ELEVATION::default();
        let mut needed = 0_u32;

        let result = GetTokenInformation(
            tokenhandle,
            TokenElevation,
            Some(&mut tokeninformation as *mut _ as _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut needed as _,
        )
        .map(|_| tokeninformation.TokenIsElevated != 0);

        let _ = CloseHandle(tokenhandle);

        result
    }
    .unwrap_or_default()
}
