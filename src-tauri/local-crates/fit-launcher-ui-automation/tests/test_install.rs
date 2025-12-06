//! Test for event-driven installer progress monitoring.
//! Run with: cargo run --example test_install -p fit-launcher-ui-automation

use std::path::Path;
use std::time::Duration;

fn main() {
    // Initialize tracing for console output
    tracing_subscriber::fmt::init();

    // Set this to a FitGirl repack setup.exe path
    let setup_path =
        Path::new(r"C:\Path\To\Your\FitGirl Repack\Game Name [FitGirl Repack]\setup.exe");

    if !setup_path.exists() {
        eprintln!("setup.exe not found at: {}", setup_path.display());
        eprintln!("Please update 'repack_dir' to point to a valid FitGirl repack folder.");
        return;
    }

    println!("=== Event-Driven Window Title Monitor Test ===");
    println!("Setup path: {}", setup_path.display());
    println!();

    let child = std::process::Command::new(&setup_path).spawn();

    match child {
        Ok(child) => {
            let root_pid = child.id();
            println!("Spawned root PID: {}", root_pid);

            // Wait a bit for child process to spawn
            std::thread::sleep(Duration::from_secs(2));

            // Try to find child process
            let child_pid = fit_launcher_ui_automation::process_utils::find_child_pid(root_pid);
            println!("Child PID: {:?}", child_pid);
            println!();

            // Use the child PID if found, otherwise use 0 (all processes)
            let monitor_pid = child_pid.unwrap_or(0);
            println!("Monitoring PID: {} (0 = all processes)", monitor_pid);
            println!();

            use fit_launcher_ui_automation::mighty::automation::win32::{
                find_completed_setup, kill_process_by_pid,
            };
            use fit_launcher_ui_automation::winevents::win_events::{
                InstallEvent, InstallPhase, monitor_install_events,
            };

            match monitor_install_events(monitor_pid) {
                Ok(rx) => {
                    let mut current_phase: Option<InstallPhase> = None;
                    let mut last_file: Option<String> = None;

                    println!("Hook started, waiting for events...");
                    println!();

                    loop {
                        match rx.recv_timeout(Duration::from_secs(60)) {
                            Ok(event) => match event {
                                InstallEvent::Phase { phase } => {
                                    if current_phase.as_ref() != Some(&phase) {
                                        println!("[PHASE    ] {:?}", phase);

                                        // Handle Finalizing phase - check for success text
                                        if matches!(phase, InstallPhase::Finalizing) {
                                            println!(
                                                "[INFO     ] Detected Finalizing, checking for success..."
                                            );
                                            std::thread::sleep(Duration::from_millis(500));

                                            if find_completed_setup() {
                                                println!(
                                                    "[SUCCESS  ] Found 'Setup has finished installing' text!"
                                                );
                                                println!("[ACTION   ] Killing processes...");
                                                if let Some(pid) = child_pid {
                                                    kill_process_by_pid(pid);
                                                }
                                                kill_process_by_pid(root_pid);
                                                break;
                                            } else {
                                                println!(
                                                    "[FAILURE  ] Success text not found - installation failed"
                                                );
                                                if let Some(pid) = child_pid {
                                                    kill_process_by_pid(pid);
                                                }
                                                kill_process_by_pid(root_pid);
                                                break;
                                            }
                                        }

                                        current_phase = Some(phase);
                                    }
                                }
                                InstallEvent::Progress { percent } => {
                                    println!("[PROGRESS ] {:.1}%", percent);
                                }
                                InstallEvent::File { path } => {
                                    if last_file.as_ref() != Some(&path) {
                                        println!("[FILE     ] {}", path);
                                        last_file = Some(path);
                                    }
                                }
                                InstallEvent::GameTitle { title } => {
                                    println!("[GAME     ] {}", title);
                                    if current_phase.as_ref() != Some(&InstallPhase::Welcome) {
                                        println!("[PHASE    ] Welcome");
                                        current_phase = Some(InstallPhase::Welcome);
                                    }
                                }
                                InstallEvent::InstallPath { path } => {
                                    println!("[PATH     ] {}", path);
                                }
                                InstallEvent::Components { list } => {
                                    println!("[COMPONENTS]");
                                    for comp in list {
                                        let status = if comp.selected { "+" } else { "-" };
                                        println!("  [{}] {}", status, comp.name);
                                    }
                                }
                                InstallEvent::DiskSpace { required_mb } => {
                                    println!("[DISKSPACE] {:.1} MB", required_mb);
                                }
                                InstallEvent::Closed => {
                                    println!("[CLOSED   ]");
                                    break;
                                }
                            },
                            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                                println!("(timeout - no events for 60s)");
                            }
                            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                                println!("(channel disconnected)");
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to set up monitor: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to spawn: {}", e);
            eprintln!("Note: setup.exe may require admin privileges.");
        }
    }
}
