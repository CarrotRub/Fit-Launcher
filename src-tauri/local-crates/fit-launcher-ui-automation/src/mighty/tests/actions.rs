use tracing::{error, warn};

use crate::mighty::{
    automation::{
        change_path_input, check_8gb_limit, click_8gb_limit, click_install_button,
        click_next_button, click_ok_button,
        win32::{find_completed_setup, mute_setup},
    },
    tests::init_test_tracing,
};

use crate::winevents::win_events::{monitor_install_events, stop_monitor, InstallEvent, InstallPhase};

#[test]
pub fn test_click_ok_button() {
    init_test_tracing();
    println!("===== Test: Click OK Button =====");
    click_ok_button();
    println!("===== Done =====");
}

#[test]
pub fn test_check_8gb_limit() {
    init_test_tracing();
    println!("===== Test: Check 8GB Limit =====");
    if check_8gb_limit() {
        println!("System under 9GB");
    } else {
        println!("System over 9GB");
    }
    println!("===== Done =====");
}

#[test]
pub fn test_click_8gb_limit() {
    init_test_tracing();
    println!("===== Test: Click 8GB Limit =====");
    click_8gb_limit();
    println!("===== Done =====");
}

#[test]
pub fn test_click_mute_song() {
    init_test_tracing();
    println!("===== Test: Click Mute Song =====");
    mute_setup();
    println!("===== Done =====");
}

#[test]
pub fn test_click_next_button() {
    init_test_tracing();
    println!("===== Test: Click Next Button =====");
    click_next_button();
    println!("===== Done =====");
}

#[test]
pub fn test_change_path_input() {
    init_test_tracing();
    println!("===== Test: Change Path Input =====");
    let test_path = "E:\\TestPath";
    change_path_input(test_path);
    println!("Path input set to {}", test_path);
    println!("===== Done =====");
}

#[test]
pub fn test_click_install_button() {
    init_test_tracing();
    println!("===== Test: Click Install Button =====");
    click_install_button();
    println!("===== Done =====");
}

#[test]
pub fn test_winevents_monitor() {
    use std::time::Duration;
    
    init_test_tracing();
    println!("===== Test: WinEvents Monitor (5 seconds) =====");
    
    let rx = monitor_install_events(0).expect("Failed to start monitor");
    
    let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_secs(5) {
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(event) => println!("Event: {:?}", event),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    
    stop_monitor();
    println!("===== Done =====");
}

#[test]
pub fn test_find_completed_window() {
    init_test_tracing();
    println!("===== Test: Find Completed Setup =====");
    find_completed_setup();
    println!("===== Done =====");
}

#[test]
pub fn test_winevents_until_complete() {
    use std::time::Duration;
    
    init_test_tracing();
    println!("===== Test: WinEvents Until Complete (60s timeout) =====");
    
    let rx = monitor_install_events(0).expect("Failed to start monitor");
    let mut current_phase: Option<InstallPhase> = None;
    let mut latest_progress: f32 = 0.0;
    
    let start = std::time::Instant::now();
    loop {
        if start.elapsed() > Duration::from_secs(60) {
            println!("Timeout after 60 seconds");
            break;
        }
        
        match rx.recv_timeout(Duration::from_millis(500)) {
            Ok(event) => match event {
                InstallEvent::Phase { phase } => {
                    if current_phase.as_ref() != Some(&phase) {
                        println!("[PHASE] {:?}", phase);
                        current_phase = Some(phase.clone());
                        
                        if matches!(phase, InstallPhase::Completed) {
                            println!("Installation completed!");
                            break;
                        }
                    }
                }
                InstallEvent::Progress { percent } => {
                    latest_progress = percent;
                    println!("[PROGRESS] {:.1}%", percent);
                }
                InstallEvent::File { path } => {
                    println!("[FILE] {}", path);
                }
                InstallEvent::Closed => {
                    println!("[CLOSED]");
                    break;
                }
                _ => {}
            },
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                // Check for completed setup window as fallback
                if find_completed_setup() {
                    println!("Found completed setup window");
                    break;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    
    stop_monitor();
    println!("Final progress: {:.1}%", latest_progress);
    println!("===== Done =====");
}
