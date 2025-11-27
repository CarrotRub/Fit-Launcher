use crate::mighty::{
    automation::{
        change_path_input, check_8gb_limit, click_8gb_limit, click_install_button,
        click_next_button, click_ok_button,
        win32::{mute_setup, poll_loop_async, poll_progress_bar_percentage},
    },
    tests::init_test_tracing,
};

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
pub fn test_poll_progress_bar() {
    init_test_tracing();
    println!("===== Test: Poll Progress Bar Percentage Once =====");
    poll_progress_bar_percentage();
    println!("===== Done =====");
}

#[tokio::test]
pub async fn test_poll_progress_bar_loop() {
    use std::time::Duration;

    init_test_tracing();
    println!("===== Test: Poll Progress Bar for 5 seconds =====");

    let result = tokio::time::timeout(Duration::from_secs(5), poll_loop_async()).await;

    match result {
        Ok(_) => println!("Poll loop finished normally"),
        Err(_) => println!("Poll loop timed out after 5 seconds"),
    }

    println!("===== Done =====");
}
