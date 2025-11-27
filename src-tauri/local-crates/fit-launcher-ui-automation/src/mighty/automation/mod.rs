#[cfg(target_os = "linux")]
pub mod linux;

#[cfg(target_os = "linux")]
use crate::mighty::automation::linux::*;

#[cfg(target_os = "windows")]
pub mod win32;

#[cfg(target_os = "windows")]
use crate::mighty::automation::win32::*;

pub fn click_ok_button() {
    click_ok_button_impl();
}
pub fn click_8gb_limit() {
    click_8gb_limit_impl();
}
pub fn click_next_button() {
    click_next_button_impl();
}
pub fn mute_setup() {
    mute_setup_impl();
}
pub fn click_install_button() {
    click_install_button_impl();
}
pub fn change_path_input(input: &str) {
    change_path_input_impl(input);
}

/// Function to check the user's ram.
///
/// Will return `true` if the user has 9gb or less and false if they have more.
///
/// Usually used before running the UI automation.
///
/// This one is cross-compatible
pub fn check_8gb_limit() -> bool {
    let mut sys: sysinfo::System = sysinfo::System::new_all();

    sys.refresh_all();
    let total_memory = sys.total_memory();

    // Convert to megabytes
    let total_memory_mb = total_memory / 1024;

    // Use 9gB because the sysinfo might round it and better be safe than sorry.
    // No need for an if-else statement.
    total_memory_mb <= 9
}
