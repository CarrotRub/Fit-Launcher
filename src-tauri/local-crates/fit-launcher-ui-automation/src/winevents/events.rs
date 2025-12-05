#[cfg(target_os = "windows")]
pub mod win_events {
    use serde::Serialize;
    use std::sync::atomic::{AtomicBool, AtomicPtr, AtomicU32, Ordering};
    use std::sync::mpsc;
    use tauri::Emitter;
    use tracing::{info, warn};
    use uuid::Uuid;

    /// Payload for hook lifecycle events
    #[derive(Serialize, Clone, Debug)]
    pub struct HookEvent {
        pub id: String,
        pub success: bool,
        pub install_path: Option<String>,
    }

    // Store the app handle and job ID globally for emitting events
    static GLOBAL_APP_HANDLE: AtomicPtr<tauri::AppHandle> = AtomicPtr::new(std::ptr::null_mut());
    static GLOBAL_JOB_ID: AtomicPtr<String> = AtomicPtr::new(std::ptr::null_mut());
    static GLOBAL_INSTALL_PATH: AtomicPtr<String> = AtomicPtr::new(std::ptr::null_mut());

    #[derive(Debug, Clone, PartialEq)]
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
    pub struct ComponentInfo {
        pub name: String,
        pub selected: bool,
    }

    #[derive(Debug, Clone)]
    pub enum InstallEvent {
        Phase { phase: InstallPhase },
        Progress { percent: f32 },
        File { path: String },
        GameTitle { title: String },
        InstallPath { path: String },
        Components { list: Vec<ComponentInfo> },
        DiskSpace { required_mb: f64 },
        Closed,
    }

    pub fn parse_title_percent(title: &str) -> Option<f32> {
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

    pub fn parse_window_title(title: &str) -> Option<InstallEvent> {
        let title = title.trim();
        if title.is_empty() {
            return None;
        }

        let lower = title.to_lowercase();

        if let Some(percent) = parse_title_percent(title) {
            return Some(InstallEvent::Progress { percent });
        }

        // File path like "C:\Games\..."
        if title.len() > 3
            && title.chars().nth(1) == Some(':')
            && title.chars().nth(2) == Some('\\')
        {
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

        // Finalization phase - FitGirl repacks show "Finalization..." or similar
        if lower.contains("saving uninstall")
            || lower.contains("finalization")
            || lower == "finalizing"
            || lower == "finalizing..."
        {
            return Some(InstallEvent::Phase {
                phase: InstallPhase::Finalizing,
            });
        }

        // Completed phase - installation finished successfully
        if lower.contains("completing")
            || lower.contains("setup has finished")
            || lower.contains("installation complete")
            || lower.contains("setup wizard")
            || lower.contains("finish")
            || lower.contains("successfully installed")
            || (lower.contains("completed") && !lower.contains("not completed"))
        // FitGirl specific: after finalization, the title often goes back to game name
        // which means installation is done - but we handle that via 100% progress check
        {
            return Some(InstallEvent::Phase {
                phase: InstallPhase::Completed,
            });
        }

        None
    }

    // Global state required because SetWinEventHook callback can't capture closures
    static GLOBAL_SENDER: AtomicPtr<mpsc::Sender<InstallEvent>> =
        AtomicPtr::new(std::ptr::null_mut());
    static MONITOR_ALL_PROCESSES: AtomicBool = AtomicBool::new(false);
    static HOOK_FAILED: AtomicBool = AtomicBool::new(false);

    /// Start monitoring with app_handle to emit Tauri events directly
    pub fn monitor_install_events_with_handle(
        app_handle: tauri::AppHandle,
        job_id: Uuid,
        process_id: u32,
        install_path: Option<String>,
    ) -> Result<mpsc::Receiver<InstallEvent>, String> {
        // Store app_handle and job_id for later use
        let handle_ptr = Box::into_raw(Box::new(app_handle.clone()));
        let old_handle = GLOBAL_APP_HANDLE.swap(handle_ptr, Ordering::SeqCst);
        if !old_handle.is_null() {
            unsafe {
                drop(Box::from_raw(old_handle));
            }
        }

        let id_str = job_id.to_string();
        let id_ptr = Box::into_raw(Box::new(id_str));
        let old_id = GLOBAL_JOB_ID.swap(id_ptr, Ordering::SeqCst);
        if !old_id.is_null() {
            unsafe {
                drop(Box::from_raw(old_id));
            }
        }

        // Store install path for later use
        if let Some(ref p) = install_path {
            info!("Storing install path in global: {}", p);
        } else {
            warn!("No install path provided to monitor");
        }

        let path_ptr = install_path
            .map(|p| Box::into_raw(Box::new(p)))
            .unwrap_or(std::ptr::null_mut());
        let old_path = GLOBAL_INSTALL_PATH.swap(path_ptr, Ordering::SeqCst);
        if !old_path.is_null() {
            unsafe {
                drop(Box::from_raw(old_path));
            }
        }

        // Reset failure flag
        HOOK_FAILED.store(false, Ordering::SeqCst);

        monitor_install_events_internal(process_id, true)
    }

    pub fn monitor_install_events(process_id: u32) -> Result<mpsc::Receiver<InstallEvent>, String> {
        monitor_install_events_internal(process_id, false)
    }

    fn monitor_install_events_internal(
        process_id: u32,
        emit_events: bool,
    ) -> Result<mpsc::Receiver<InstallEvent>, String> {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook, UnhookWinEvent};
        use windows::Win32::UI::WindowsAndMessaging::{
            DispatchMessageW, MSG, PM_REMOVE, PeekMessageW, TranslateMessage,
            WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
        };

        const EVENT_OBJECT_NAMECHANGE: u32 = 0x800C;

        let (tx, rx) = mpsc::channel();
        let tx_ptr = Box::into_raw(Box::new(tx));
        GLOBAL_SENDER.store(tx_ptr, Ordering::SeqCst);
        MONITOR_ALL_PROCESSES.store(process_id == 0, Ordering::SeqCst);

        std::thread::spawn(move || {
            unsafe extern "system" fn event_callback(
                _hook: HWINEVENTHOOK,
                event: u32,
                hwnd: HWND,
                id_object: i32,
                _id_child: i32,
                _event_thread: u32,
                _event_time: u32,
            ) {
                use windows::Win32::UI::WindowsAndMessaging::GetWindowTextW;

                const EVENT_OBJECT_NAMECHANGE: u32 = 0x800C;

                let tx_ptr = GLOBAL_SENDER.load(Ordering::SeqCst);
                if tx_ptr.is_null() {
                    return;
                }
                let tx = unsafe { &*tx_ptr };

                if event == EVENT_OBJECT_NAMECHANGE && id_object == 0 {
                    let mut buf = [0u16; 512];
                    let len = unsafe { GetWindowTextW(hwnd, &mut buf) };
                    if len > 0 {
                        let title = String::from_utf16_lossy(&buf[..len as usize]);

                        // Check if this looks like a setup window
                        // Include "Finalization" for the final phase detection
                        if title.contains("Setup")
                            || title.contains("%")
                            || title.contains("Finalization")
                        {
                            if let Some(event) = parse_window_title(&title) {
                                let _ = tx.send(event);
                            }
                        }
                    }
                }
            }

            unsafe {
                let target_pid = if MONITOR_ALL_PROCESSES.load(Ordering::SeqCst) {
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
                    warn!("Failed to set SetWinEventHook");
                    return;
                }

                info!(
                    "WinEvents hook active (SetWinEventHook) - listening for window title changes"
                );

                // Emit setup::hook::started event
                if emit_events {
                    let handle_ptr = GLOBAL_APP_HANDLE.load(Ordering::SeqCst);
                    let id_ptr = GLOBAL_JOB_ID.load(Ordering::SeqCst);
                    if !handle_ptr.is_null() && !id_ptr.is_null() {
                        let handle = &*handle_ptr;
                        let id = &*id_ptr;
                        let _ = handle.emit(
                            "setup::hook::started",
                            HookEvent {
                                id: id.clone(),
                                success: true,
                                install_path: None,
                            },
                        );
                    }
                }

                let mut msg = MSG::default();
                loop {
                    while PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).as_bool() {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }

                    if GLOBAL_SENDER.load(Ordering::SeqCst).is_null() {
                        break;
                    }

                    std::thread::sleep(std::time::Duration::from_millis(10));
                }

                let _ = UnhookWinEvent(hook);
                info!("WinEvents hook stopped");

                // Emit setup::hook::stopped event
                if emit_events {
                    let handle_ptr = GLOBAL_APP_HANDLE.load(Ordering::SeqCst);
                    let id_ptr = GLOBAL_JOB_ID.load(Ordering::SeqCst);
                    let path_ptr = GLOBAL_INSTALL_PATH.load(Ordering::SeqCst);
                    if !handle_ptr.is_null() && !id_ptr.is_null() {
                        let handle = &*handle_ptr;
                        let id = &*id_ptr;
                        let failed = HOOK_FAILED.load(Ordering::SeqCst);
                        let install_path = if !path_ptr.is_null() {
                            let p = (*path_ptr).clone();
                            info!("Emitting stopped event with install_path: {}", p);
                            Some(p)
                        } else {
                            warn!("Emitting stopped event with NO install_path");
                            None
                        };
                        let _ = handle.emit(
                            "setup::hook::stopped",
                            HookEvent {
                                id: id.clone(),
                                success: !failed,
                                install_path,
                            },
                        );
                    }
                }

                let tx_ptr = GLOBAL_SENDER.swap(std::ptr::null_mut(), Ordering::SeqCst);
                if !tx_ptr.is_null() {
                    drop(Box::from_raw(tx_ptr));
                }
            }
        });

        Ok(rx)
    }

    /// Mark the hook as failed (cancelled/timeout) before stopping
    pub fn mark_hook_failed() {
        HOOK_FAILED.store(true, Ordering::SeqCst);
    }

    /// Check if the hook was marked as failed
    pub fn was_hook_failed() -> bool {
        HOOK_FAILED.load(Ordering::SeqCst)
    }

    /// Reset failure flag (call before starting new monitor)
    pub fn reset_hook_state() {
        HOOK_FAILED.store(false, Ordering::SeqCst);
    }

    pub fn stop_monitor() {
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
    #[cfg(target_os = "windows")]
    #[test]
    fn test_parse_title_percent() {
        use super::win_events::parse_title_percent;

        assert_eq!(parse_title_percent("Setup - 45.2%"), Some(45.2));
        assert_eq!(parse_title_percent("50%"), Some(50.0));
        assert_eq!(
            parse_title_percent("Installing: 99.9% complete"),
            Some(99.9)
        );
        assert_eq!(parse_title_percent("No percent here"), None);
    }
}
