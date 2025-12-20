//! Installer runner that coordinates the installation workflow.

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use anyhow::{Context, Result, bail};
use tracing::{info, warn};
use windows::Win32::System::Threading::GetProcessId;
use windows::Win32::UI::Shell::{SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW, ShellExecuteExW};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWMINNOACTIVE;
use windows::core::PCWSTR;

use crate::automation::{
    click_install, click_next, click_ok, completed_setup, kill_process, minimize_setup,
    mute_process_audio, needs_ram_limit, set_install_path, toggle_ram_limit,
};
use crate::events::{EventMonitor, InstallEvent};
use crate::ipc::protocol::{Event, InstallOptions, InstallPhase};
use crate::utils::encode_utf16le_with_null;

/// Orchestrates the complete installation workflow.
pub struct InstallerRunner {
    job_id: String,
    setup_path: PathBuf,
    install_path: PathBuf,
    options: InstallOptions,
    cancelled: Arc<AtomicBool>,
}

impl InstallerRunner {
    /// Create a new installer runner.
    pub fn new(
        job_id: String,
        setup_path: String,
        install_path: String,
        options: InstallOptions,
    ) -> Self {
        Self {
            job_id,
            setup_path: PathBuf::from(setup_path),
            install_path: PathBuf::from(install_path),
            options,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Request cancellation of the installation.
    pub fn cancel(&self) {
        info!("Cancellation requested for job: {}", self.job_id);
        self.cancelled.store(true, Ordering::SeqCst);
    }

    /// Check if cancellation was requested.
    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    /// Run the complete installation workflow.
    ///
    /// The `emit` callback is called for each event that should be sent to the GUI.
    pub fn run<F>(&self, mut emit: F) -> Result<()>
    where
        F: FnMut(&Event) -> Result<()>,
    {
        // Validate paths
        if !self.setup_path.exists() {
            bail!("Setup executable not found: {:?}", self.setup_path);
        }

        // Build component args
        let components = self.build_component_args();

        // Start setup.exe
        emit(&Event::Phase {
            job_id: self.job_id.clone(),
            phase: InstallPhase::Preparing,
        })?;

        let root_pid = self.spawn_setup(&components)?;
        info!("Started setup.exe with PID: {}", root_pid);

        // Give the installer time to start
        std::thread::sleep(Duration::from_millis(1500));

        if self.is_cancelled() {
            kill_process(root_pid);
            return Ok(());
        }

        // Run UI automation sequence
        emit(&Event::Phase {
            job_id: self.job_id.clone(),
            phase: InstallPhase::SelectLanguage,
        })?;

        self.run_automation()?;

        if self.is_cancelled() {
            kill_process(root_pid);
            return Ok(());
        }

        // Find the child process that actually handles the installer UI
        let installer_pid = self.find_installer_pid(root_pid);
        if let Some(pid) = installer_pid {
            info!("Found installer child process: PID {}", pid);
            mute_process_audio(pid);
        }

        // Start event monitoring
        emit(&Event::Phase {
            job_id: self.job_id.clone(),
            phase: InstallPhase::Extracting,
        })?;

        let monitor = EventMonitor::new(installer_pid.unwrap_or(0));
        self.monitor_progress(&monitor, &mut emit)?;

        // Check final status
        let success = completed_setup();

        if success {
            emit(&Event::Completed {
                job_id: self.job_id.clone(),
                success: true,
                install_path: Some(self.install_path.to_string_lossy().to_string()),
                error: None,
            })?;
        } else if self.is_cancelled() {
            emit(&Event::Completed {
                job_id: self.job_id.clone(),
                success: false,
                install_path: None,
                error: Some("Installation was cancelled".to_string()),
            })?;
        } else {
            // Try to capture actual error message from installer window
            let error_msg = crate::errors::capture_error_text()
                .unwrap_or_else(|| "Installation did not complete successfully".to_string());

            emit(&Event::Completed {
                job_id: self.job_id.clone(),
                success: false,
                install_path: None,
                error: Some(error_msg),
            })?;
        }

        // Cleanup - kill any remaining processes
        if let Some(pid) = installer_pid {
            kill_process(pid);
        }
        kill_process(root_pid);

        Ok(())
    }

    /// Build the /COMPONENTS argument string.
    fn build_component_args(&self) -> String {
        let mut components = Vec::new();

        if self.options.install_directx {
            components.push("directx");
        }
        if self.options.install_vcredist {
            components.push("microsoft");
        }

        if components.is_empty() {
            String::new()
        } else {
            format!("/COMPONENTS=\"{}\"", components.join(","))
        }
    }

    /// Spawn the setup executable.
    fn spawn_setup(&self, components_arg: &str) -> Result<u32> {
        // FitGirl repacks sometimes have a temp setup pattern
        let temp_path = self.setup_path.with_extension("temp_setup.exe");

        // Copy to temp location to avoid file locking issues
        std::fs::copy(&self.setup_path, &temp_path)
            .with_context(|| format!("Failed to copy setup to temp location: {:?}", temp_path))?;

        let verb = encode_utf16le_with_null("runas");
        let file = encode_utf16le_with_null(temp_path);
        let params = encode_utf16le_with_null(components_arg);
        let working_dir = self
            .setup_path
            .parent()
            .context("Setup path has no parent directory")?;

        // CRITICAL: Set working directory to where the .bin files are
        // Inno Setup needs to find its data files (fg-01.bin, fg-02.bin, etc.)
        let directory = encode_utf16le_with_null(working_dir);

        let params = if !components_arg.is_empty() {
            PCWSTR(params.as_ptr())
        } else {
            PCWSTR::null()
        };

        let mut sei = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_NOCLOSEPROCESS,
            lpVerb: PCWSTR(verb.as_ptr()),
            lpFile: PCWSTR(file.as_ptr()),
            lpParameters: params,
            lpDirectory: PCWSTR(directory.as_ptr()),
            nShow: SW_SHOWMINNOACTIVE.0,
            ..Default::default()
        };

        unsafe {
            ShellExecuteExW(&mut sei).with_context(|| "Failed to spawn setup.exe")?;

            // SAFETY: ShellExecuteExW error muse be handled for valid handle
            let child_proc = windows::core::Owned::new(sei.hProcess);
            Ok(GetProcessId(*child_proc))
        }
    }

    /// Run the UI automation sequence.
    fn run_automation(&self) -> Result<()> {
        click_ok();
        std::thread::sleep(Duration::from_millis(1000));

        let system_has_low_ram = needs_ram_limit();
        let user_wants_limit = self.options.two_gb_limit;

        if system_has_low_ram != user_wants_limit && (system_has_low_ram || user_wants_limit) {
            toggle_ram_limit();
            std::thread::sleep(Duration::from_millis(200));
        }

        click_next();
        click_next();
        set_install_path(&self.install_path.to_string_lossy());
        click_next();
        click_install();

        minimize_setup();

        std::thread::sleep(Duration::from_millis(500));

        Ok(())
    }

    /// Find the child process that owns the installer window.
    fn find_installer_pid(&self, root_pid: u32) -> Option<u32> {
        // Try multiple times with delays
        for _attempt in 0..10 {
            if let Some(pid) = find_child_pid(root_pid) {
                return Some(pid);
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        None
    }

    /// Monitor progress events and relay them to the GUI.
    fn monitor_progress<F>(&self, monitor: &EventMonitor, emit: &mut F) -> Result<()>
    where
        F: FnMut(&Event) -> Result<()>,
    {
        // Each recv_timeout is 5 seconds, track consecutive timeouts
        let recv_timeout = Duration::from_secs(5);
        let max_consecutive_timeouts = 12; // 12 * 5s = 60s total idle time
        let mut consecutive_timeouts = 0u32;

        let mut last_percent: f32 = 0.0;
        let mut current_phase = InstallPhase::Extracting;

        loop {
            if self.is_cancelled() {
                break;
            }

            // Check for error dialog (ISDone.dll popup) on every iteration
            // This catches errors even while progress events are still flowing
            if let Some(error_msg) = crate::errors::capture_error_text() {
                warn!("Error dialog detected: {}", error_msg);
                emit(&Event::Phase {
                    job_id: self.job_id.clone(),
                    phase: InstallPhase::Failed,
                })?;
                break;
            }

            match monitor.recv_timeout(recv_timeout) {
                Ok(event) => {
                    // Reset timeout counter on any event
                    consecutive_timeouts = 0;

                    match event {
                        InstallEvent::Progress { percent } => {
                            // Only emit if changed significantly
                            if (percent - last_percent).abs() >= 0.5 {
                                emit(&Event::Progress {
                                    job_id: self.job_id.clone(),
                                    percent,
                                })?;
                                last_percent = percent;
                            }
                        }
                        InstallEvent::Phase { phase } => {
                            let new_phase = convert_phase(phase);
                            if new_phase != current_phase {
                                emit(&Event::Phase {
                                    job_id: self.job_id.clone(),
                                    phase: new_phase,
                                })?;
                                current_phase = new_phase;

                                // Stop monitoring if completed or failed
                                if matches!(
                                    new_phase,
                                    InstallPhase::Completed
                                        | InstallPhase::Failed
                                        | InstallPhase::Finalizing
                                ) {
                                    // Wait a bit for finalization to complete
                                    if new_phase == InstallPhase::Finalizing {
                                        std::thread::sleep(Duration::from_millis(500));
                                    }
                                    break;
                                }
                            }
                        }
                        InstallEvent::File { path } => {
                            emit(&Event::File {
                                job_id: self.job_id.clone(),
                                path,
                            })?;
                        }
                        InstallEvent::GameTitle { title } => {
                            emit(&Event::GameTitle {
                                job_id: self.job_id.clone(),
                                title,
                            })?;
                        }
                        InstallEvent::Closed => {
                            info!("Installer window closed");
                            break;
                        }
                    }
                }
                Err(_) => {
                    consecutive_timeouts += 1;

                    // Check if setup completed (finish dialog showing)
                    if completed_setup() {
                        info!("Found completed setup dialog");
                        break;
                    }

                    // If we've had too many timeouts, assume installer is frozen
                    if consecutive_timeouts >= max_consecutive_timeouts {
                        warn!("Installation timeout: no events for 60 seconds, assuming frozen");
                        emit(&Event::Phase {
                            job_id: self.job_id.clone(),
                            phase: InstallPhase::Failed,
                        })?;
                        break;
                    }
                }
            }
        }

        Ok(())
    }
}

/// Convert internal event phase to IPC protocol phase.
fn convert_phase(phase: crate::events::InstallPhase) -> InstallPhase {
    match phase {
        crate::events::InstallPhase::SelectLanguage => InstallPhase::SelectLanguage,
        crate::events::InstallPhase::Welcome => InstallPhase::Welcome,
        crate::events::InstallPhase::Information => InstallPhase::Information,
        crate::events::InstallPhase::SelectDestination => InstallPhase::SelectDestination,
        crate::events::InstallPhase::SelectComponents => InstallPhase::SelectComponents,
        crate::events::InstallPhase::Preparing => InstallPhase::Preparing,
        crate::events::InstallPhase::Extracting => InstallPhase::Extracting,
        crate::events::InstallPhase::Unpacking => InstallPhase::Unpacking,
        crate::events::InstallPhase::Finalizing => InstallPhase::Finalizing,
        crate::events::InstallPhase::Completed => InstallPhase::Completed,
        crate::events::InstallPhase::Failed => InstallPhase::Failed,
    }
}

/// Find child process of a given PID.
fn find_child_pid(parent_pid: u32) -> Option<u32> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, PROCESSENTRY32, Process32First, Process32Next, TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;

        let mut entry = PROCESSENTRY32 {
            dwSize: std::mem::size_of::<PROCESSENTRY32>() as u32,
            ..Default::default()
        };

        if Process32First(snapshot, &mut entry).is_ok() {
            loop {
                if entry.th32ParentProcessID == parent_pid {
                    let _ = CloseHandle(snapshot);
                    return Some(entry.th32ProcessID);
                }
                if Process32Next(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
    }

    None
}
