//! IPC Client for communicating with the elevated installer controller.

use std::path::PathBuf;
use std::time::Duration;

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use specta::Type;
use tracing::{debug, info};

#[cfg(windows)]
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_SHARE_NONE,
    OPEN_EXISTING, ReadFile, WriteFile,
};
#[cfg(windows)]
use windows::Win32::System::Pipes::WaitNamedPipeW;
#[cfg(windows)]
use windows::Win32::UI::Shell::{SHELLEXECUTEINFOW, ShellExecuteExW};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
#[cfg(windows)]
use windows::core::PCWSTR;

use crate::defender::{ExclusionAction, ExclusionCleanupPolicy};

// ─────────────────────────────────────────────────────────────────────────────
// Protocol Types (mirrored from controller crate)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallOptions {
    pub two_gb_limit: bool,
    pub install_directx: bool,
    pub install_vcredist: bool,
}

impl Default for InstallOptions {
    fn default() -> Self {
        Self {
            two_gb_limit: false,
            install_directx: true,
            install_vcredist: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ControllerCommand {
    StartInstall {
        job_id: String,
        setup_path: String,
        install_path: String,
        options: InstallOptions,
    },
    CancelInstall {
        job_id: String,
    },
    FolderExclusion {
        action: ExclusionAction,
    },
    CleanupPolicy {
        exclusion_folder: ExclusionCleanupPolicy,
    },
    Shutdown,
    ShutdownIfIdle,
    Ping,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ControllerEvent {
    Ready,
    Pong,
    Phase {
        job_id: String,
        phase: InstallPhase,
    },
    Progress {
        job_id: String,
        percent: f32,
    },
    File {
        job_id: String,
        path: String,
    },
    GameTitle {
        job_id: String,
        title: String,
    },
    Completed {
        job_id: String,
        success: bool,
        install_path: Option<String>,
        error: Option<String>,
    },
    FolderExclusionResult {
        success: bool,
        error: Option<String>,
    },
    Error {
        job_id: Option<String>,
        message: String,
    },
    ShuttingDown,
}

// ─────────────────────────────────────────────────────────────────────────────
// Wire Format (length-prefixed JSON)
// ─────────────────────────────────────────────────────────────────────────────

fn encode_message<T: Serialize>(msg: &T) -> Result<Vec<u8>> {
    let json = serde_json::to_vec(msg)?;
    let mut buf = Vec::with_capacity(4 + json.len());
    buf.extend_from_slice(&(json.len() as u32).to_le_bytes());
    buf.extend_from_slice(&json);
    Ok(buf)
}

fn decode_message<T: for<'de> Deserialize<'de>>(buf: &[u8]) -> Result<Option<(T, usize)>> {
    if buf.len() < 4 {
        return Ok(None);
    }

    let len = u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]) as usize;
    let total = 4 + len;

    if buf.len() < total {
        return Ok(None);
    }

    let msg: T = serde_json::from_slice(&buf[4..total])?;
    Ok(Some((msg, total)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller Client
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(windows)]
pub struct ControllerClient {
    pipe_handle: HANDLE,
    read_buffer: Vec<u8>,
    pending_data: Vec<u8>,
}

// Windows HANDLEs are just kernel object identifiers - safe to send across threads.
#[cfg(windows)]
unsafe impl Send for ControllerClient {}

#[cfg(windows)]
impl ControllerClient {
    /// Spawns the controller with UAC elevation and connects to its pipe.
    pub fn spawn_and_connect(controller_path: &PathBuf, pipe_name: &str) -> Result<Self> {
        info!("Spawning elevated controller: {:?}", controller_path);

        let verb: Vec<u16> = "runas\0".encode_utf16().collect();
        let file: Vec<u16> = controller_path
            .to_string_lossy()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let params: Vec<u16> = pipe_name.encode_utf16().chain(std::iter::once(0)).collect();

        let mut sei = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: Default::default(),
            lpVerb: PCWSTR(verb.as_ptr()),
            lpFile: PCWSTR(file.as_ptr()),
            lpParameters: PCWSTR(params.as_ptr()),
            nShow: SW_HIDE.0,
            ..Default::default()
        };

        unsafe {
            ShellExecuteExW(&mut sei).with_context(|| "Failed to spawn elevated controller")?;
        }

        // Don't use sei.hProcess - when launching elevated from non-elevated,
        // the returned handle is restricted and unreliable. Pipe is our only handshake.

        info!("Elevated controller spawned, waiting for pipe...");
        std::thread::sleep(Duration::from_millis(1500));

        Self::connect_with_timeout(pipe_name, 15000)
    }

    fn connect_with_timeout(pipe_name: &str, timeout_ms: u32) -> Result<Self> {
        let pipe_wide: Vec<u16> = pipe_name.encode_utf16().chain(std::iter::once(0)).collect();

        unsafe {
            if !WaitNamedPipeW(PCWSTR(pipe_wide.as_ptr()), timeout_ms).as_bool() {
                bail!("Installer controller failed to start (UAC canceled or startup error)");
            }
        }

        let handle = unsafe {
            CreateFileW(
                PCWSTR(pipe_wide.as_ptr()),
                (FILE_GENERIC_READ | FILE_GENERIC_WRITE).0,
                FILE_SHARE_NONE,
                None,
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                None,
            )?
        };

        if handle == INVALID_HANDLE_VALUE {
            bail!("Failed to open pipe: {}", pipe_name);
        }

        info!("Connected to controller pipe: {}", pipe_name);

        Ok(Self {
            pipe_handle: handle,
            read_buffer: vec![0u8; 65536],
            pending_data: Vec::new(),
        })
    }

    pub fn connect(pipe_name: &str) -> Result<Self> {
        Self::connect_with_timeout(pipe_name, 5000)
    }

    pub fn send_command(&self, cmd: &ControllerCommand) -> Result<()> {
        let data = encode_message(cmd)?;
        let mut written = 0u32;

        unsafe {
            WriteFile(self.pipe_handle, Some(&data), Some(&mut written), None)
                .context("Failed to write to pipe")?;
        }
        // FlushFileBuffers is unnecessary for named pipes and can cause deadlocks

        debug!("Sent command: {:?}", cmd);
        Ok(())
    }

    /// Blocking read - waits until data arrives or pipe closes.
    pub fn try_recv(&mut self) -> Result<Option<ControllerEvent>> {
        if let Some((event, consumed)) = decode_message::<ControllerEvent>(&self.pending_data)? {
            self.pending_data.drain(..consumed);
            return Ok(Some(event));
        }

        let mut bytes_read = 0u32;
        let result = unsafe {
            ReadFile(
                self.pipe_handle,
                Some(&mut self.read_buffer),
                Some(&mut bytes_read),
                None,
            )
        };

        if let Err(e) = result {
            let err = std::io::Error::last_os_error();
            if err.raw_os_error() == Some(109) {
                bail!("Controller disconnected");
            }
            return Err(e.into());
        }

        if bytes_read > 0 {
            self.pending_data
                .extend_from_slice(&self.read_buffer[..bytes_read as usize]);

            if let Some((event, consumed)) = decode_message::<ControllerEvent>(&self.pending_data)?
            {
                self.pending_data.drain(..consumed);
                return Ok(Some(event));
            }
        }

        Ok(None)
    }

    pub fn recv_timeout(&mut self, timeout: Duration) -> Result<Option<ControllerEvent>> {
        let deadline = std::time::Instant::now() + timeout;

        while std::time::Instant::now() < deadline {
            if let Some(event) = self.try_recv()? {
                return Ok(Some(event));
            }
            std::thread::sleep(Duration::from_millis(10));
        }

        Ok(None)
    }

    pub fn shutdown(&self) -> Result<()> {
        self.send_command(&ControllerCommand::Shutdown)
    }

    pub fn ping(&mut self) -> Result<bool> {
        self.send_command(&ControllerCommand::Ping)?;
        match self.recv_timeout(Duration::from_secs(2))? {
            Some(ControllerEvent::Pong) => Ok(true),
            _ => Ok(false),
        }
    }
}

#[cfg(windows)]
impl Drop for ControllerClient {
    fn drop(&mut self) {
        info!("Closing controller connection");
        let _ = self.shutdown();
        // Pipe close signals shutdown - let Windows manage the elevated process
        unsafe {
            let _ = CloseHandle(self.pipe_handle);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

pub fn find_controller_binary() -> Result<PathBuf> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .context("No parent directory")?
        .to_path_buf();

    let candidates = [
        exe_dir.join("FitLauncherService.exe"),
        exe_dir.join("resources").join("FitLauncherService.exe"),
        exe_dir
            .join("..")
            .join("resources")
            .join("FitLauncherService.exe"),
    ];

    candidates
        .iter()
        .find(|p| p.exists())
        .cloned()
        .ok_or_else(|| {
            anyhow::anyhow!(
                "Controller binary not found. Tried: {:?}",
                candidates
                    .iter()
                    .map(|p| p.display().to_string())
                    .collect::<Vec<_>>()
            )
        })
}

pub fn generate_pipe_name() -> String {
    format!(r"\\.\pipe\fit-launcher-automation-{}", uuid::Uuid::new_v4())
}
