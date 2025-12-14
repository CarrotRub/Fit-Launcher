//! Event monitoring using SetWinEventHook.
//!
//! Monitors window title changes to track installation progress.

use std::sync::OnceLock;
use std::sync::atomic::{AtomicPtr, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::time::Duration;

use tracing::{info, warn};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook, UnhookWinEvent};
use windows::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, GetWindowTextW, MSG, PM_REMOVE, PeekMessageW, TranslateMessage,
    WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallPhase {
    SelectLanguage,
    Welcome,
    Information,
    SelectDestination,
    SelectComponents,
    Preparing,
    Extracting,
    Unpacking,
    Finalizing,
    Completed,
    Failed,
}

#[derive(Debug, Clone)]
pub enum InstallEvent {
    Phase { phase: InstallPhase },
    Progress { percent: f32 },
    File { path: String },
    GameTitle { title: String },
    Closed,
}

fn parse_percent(title: &str) -> Option<f32> {
    let pct_pos = title.find('%')?;
    let before = &title[..pct_pos];
    let start = before
        .rfind(|c: char| !c.is_ascii_digit() && c != '.')
        .map(|i| i + 1)
        .unwrap_or(0);
    before[start..].parse().ok()
}

fn parse_game_title(title: &str) -> Option<String> {
    if title.starts_with("Setup - ") && !title.contains('%') {
        let game = title.strip_prefix("Setup - ")?;
        if !game.is_empty() && !game.to_lowercase().contains("install") {
            return Some(game.to_string());
        }
    }
    None
}

fn parse_window_title(title: &str) -> Option<InstallEvent> {
    let title = title.trim();
    if title.is_empty() {
        return None;
    }

    let lower = title.to_lowercase();

    if let Some(percent) = parse_percent(title) {
        return Some(InstallEvent::Progress { percent });
    }

    if title.len() > 3 && title.chars().nth(1) == Some(':') && title.chars().nth(2) == Some('\\') {
        return Some(InstallEvent::File {
            path: title.to_string(),
        });
    }

    if let Some(game_title) = parse_game_title(title) {
        return Some(InstallEvent::GameTitle { title: game_title });
    }

    if lower == "setup" {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::SelectLanguage,
        });
    }

    if lower == "information" || lower.contains("please read") {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::Information,
        });
    }

    if lower.contains("where should") && lower.contains("be installed") {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::SelectDestination,
        });
    }

    if lower.contains("which components") {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::SelectComponents,
        });
    }

    if lower.contains("preparing to install") || lower.contains("ready to install") {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::Preparing,
        });
    }

    if lower.contains("please wait while setup installs")
        || lower.contains("extracting files")
        || lower == "installing"
    {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::Extracting,
        });
    }

    if lower == "unpacking" || lower == "unpacking..." {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::Unpacking,
        });
    }

    if lower.contains("saving uninstall")
        || lower.contains("finalization")
        || lower == "finalizing"
        || lower == "finalizing..."
    {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::Finalizing,
        });
    }

    if lower.contains("completing")
        || lower.contains("setup has finished")
        || lower.contains("installation complete")
        || lower.contains("finish")
        || lower.contains("successfully installed")
        || (lower.contains("completed") && !lower.contains("not completed"))
    {
        return Some(InstallEvent::Phase {
            phase: InstallPhase::Completed,
        });
    }

    None
}

static GLOBAL_SENDER: AtomicPtr<Sender<InstallEvent>> = AtomicPtr::new(std::ptr::null_mut());
static MONITOR_ALL_PIDS: OnceLock<bool> = OnceLock::new();

unsafe extern "system" fn event_callback(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    id_object: i32,
    _id_child: i32,
    _event_thread: u32,
    _event_time: u32,
) {
    unsafe {
        const EVENT_OBJECT_NAMECHANGE: u32 = 0x800C;

        let tx_ptr = GLOBAL_SENDER.load(Ordering::SeqCst);
        if tx_ptr.is_null() {
            return;
        }
        let tx = &*tx_ptr;

        if event == EVENT_OBJECT_NAMECHANGE && id_object == 0 {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buf);

            if len > 0 {
                let title = String::from_utf16_lossy(&buf[..len as usize]);

                if title.contains("Setup") || title.contains("%") || title.contains("Finalization")
                {
                    if let Some(event) = parse_window_title(&title) {
                        let _ = tx.send(event);
                    }
                }
            }
        }
    }
}

pub struct EventMonitor {
    receiver: Receiver<InstallEvent>,
}

impl EventMonitor {
    pub fn new(process_id: u32) -> Self {
        let (tx, rx) = mpsc::channel();

        let tx_ptr = Box::into_raw(Box::new(tx));
        let old_ptr = GLOBAL_SENDER.swap(tx_ptr, Ordering::SeqCst);
        if !old_ptr.is_null() {
            unsafe {
                drop(Box::from_raw(old_ptr));
            }
        }

        let monitor_all = process_id == 0;
        let _ = MONITOR_ALL_PIDS.set(monitor_all);

        std::thread::spawn(move || {
            const EVENT_OBJECT_NAMECHANGE: u32 = 0x800C;

            unsafe {
                let target_pid = if *MONITOR_ALL_PIDS.get().unwrap_or(&false) {
                    0
                } else {
                    process_id
                };

                let hook = SetWinEventHook(
                    EVENT_OBJECT_NAMECHANGE,
                    EVENT_OBJECT_NAMECHANGE,
                    None,
                    Some(event_callback),
                    target_pid,
                    0,
                    WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
                );

                if hook.is_invalid() {
                    warn!("Failed to set WinEventHook");
                    return;
                }

                info!("WinEventHook active for PID {}", target_pid);

                let mut msg = MSG::default();
                loop {
                    while PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).as_bool() {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }

                    if GLOBAL_SENDER.load(Ordering::SeqCst).is_null() {
                        break;
                    }

                    std::thread::sleep(Duration::from_millis(10));
                }

                let _ = UnhookWinEvent(hook);
                info!("WinEventHook stopped");
            }
        });

        Self { receiver: rx }
    }

    pub fn recv_timeout(&self, timeout: Duration) -> Result<InstallEvent, RecvTimeoutError> {
        self.receiver.recv_timeout(timeout)
    }

    pub fn try_recv(&self) -> Option<InstallEvent> {
        self.receiver.try_recv().ok()
    }
}

impl Drop for EventMonitor {
    fn drop(&mut self) {
        let tx_ptr = GLOBAL_SENDER.swap(std::ptr::null_mut(), Ordering::SeqCst);
        if !tx_ptr.is_null() {
            unsafe {
                drop(Box::from_raw(tx_ptr));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_percent() {
        assert_eq!(parse_percent("Setup - 45.2%"), Some(45.2));
        assert_eq!(parse_percent("50%"), Some(50.0));
        assert_eq!(parse_percent("Installing: 99.9% complete"), Some(99.9));
        assert_eq!(parse_percent("No percent here"), None);
    }

    #[test]
    fn test_parse_game_title() {
        assert_eq!(
            parse_game_title("Setup - Cyberpunk 2077"),
            Some("Cyberpunk 2077".to_string())
        );
        assert_eq!(parse_game_title("Setup - 45%"), None);
        assert_eq!(parse_game_title("Setup - Installing"), None);
    }
}
