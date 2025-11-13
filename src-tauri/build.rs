use std::process::Command;

use tauri_build::WindowsAttributes;

pub fn kill_existing_aria2c() -> Result<(), String> {
    println!("Attempting to kill existing aria2c.exe processes...");

    let graceful_status = Command::new("taskkill")
        .args(["/IM", "aria2c.exe", "/T"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    match graceful_status {
        Ok(status) if status.success() => {
            println!("Successfully terminated aria2c.exe processes gracefully");
            return Ok(());
        }
        _ => {
            println!("Graceful termination failed, trying forceful method");
        }
    }

    let force_status = Command::new("taskkill")
        .args(["/IM", "aria2c.exe", "/F", "/T"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    match force_status {
        Ok(status) if status.success() => {
            println!("Successfully force-killed aria2c.exe processes");
            Ok(())
        }
        Ok(status) => {
            if status.code() == Some(128) {
                println!("No aria2c.exe processes were running");
                Ok(())
            } else {
                println!(
                    "Failed to kill aria2c.exe processes with status: {:?}",
                    status.code()
                );
                Err(format!("Failed to kill processes with status {status}"))
            }
        }
        Err(e) => {
            println!("Failed to execute taskkill: {e}");
            Err(format!("Failed to execute taskkill: {e}"))
        }
    }
}

fn main() {
    let _ = kill_existing_aria2c();
    let tauri_options = tauri_helper::TauriHelperOptions::new(true, None);
    tauri_helper::generate_command_file(tauri_options);
    let win_attr = if tauri_build::is_dev() {
        WindowsAttributes::new()
    } else {
        WindowsAttributes::new().app_manifest(
            r#"
    <assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
      <dependency>
        <dependentAssembly>
          <assemblyIdentity
            type="win32"
            name="Microsoft.Windows.Common-Controls"
            version="6.0.0.0"
            processorArchitecture="*"
            publicKeyToken="6595b64144ccf1df"
            language="*"
          />
        </dependentAssembly>
      </dependency>
      <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
        <security>
            <requestedPrivileges>
                <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
            </requestedPrivileges>
        </security>
      </trustInfo>
    </assembly>
    "#,
        )
    };

    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(win_attr))
        .expect("failed to run build script");
}
