use std::path::PathBuf;

use specta::specta;
#[cfg(target_os = "windows")]
use tracing::{error, info};

/// Start an executable using tauri::command
///
/// Uses ShellExecuteW to delegate to the Windows shell, which handles UAC
/// elevation automatically if the executable requires it.
#[tauri::command]
#[specta]
pub fn start_executable(path: String) {
    let path = PathBuf::from(path);

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        use windows::core::PCWSTR;

        // Convert path to wide string
        let path_wide: Vec<u16> = encode_utf16le_with_null(&path);

        // Get working directory (parent of executable)
        let current = PathBuf::from(".");
        let working_dir = path.parent().unwrap_or(&current);
        let working_dir_wide: Vec<u16> = encode_utf16le_with_null(working_dir);

        // ShellExecuteW with "open" verb - Windows handles UAC automatically
        let result = unsafe {
            ShellExecuteW(
                None,
                PCWSTR::null(),
                PCWSTR(path_wide.as_ptr()),
                PCWSTR::null(),
                PCWSTR(working_dir_wide.as_ptr()),
                SW_SHOWNORMAL,
            )
        };

        let result_code = result.0 as isize;
        if result_code > 32 {
            info!("Executable launched via shell: {}", path.display());
        } else {
            error!(
                "Failed to launch {path:?} via shell, error code: {}",
                result_code
            );
        }
    }

    #[cfg(target_os = "linux")]
    // TODO: WINEPREFIX + wine command configuration
    // by allowing custom commands, `protonrun` e.g. should be supported automatically
    // Add usage of wine + check beforehand with Flatpak if steamos
    {}
}

#[cfg(windows)]
fn encode_utf16le_with_null(s: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;

    s.as_ref().encode_wide().chain(std::iter::once(0)).collect()
}
