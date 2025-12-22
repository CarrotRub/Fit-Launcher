//! Named Pipe server for receiving commands from the GUI.
//!
//! # Security Model
//!
//! The pipe is protected with a user-SID-restricted DACL:
//! - Only the current NT user can connect (blocks other local users, SYSTEM, services)
//! - Combined with random pipe names (UUID) to prevent opportunistic probing
//! - Controller has narrow capabilities (install operations only)
//!
//! ## In Scope Threats (mitigated)
//! - Other local users on the same machine
//! - Services / SYSTEM accounts
//! - Opportunistic local processes probing predictable IPC endpoints
//! - Accidental cross-talk / stale instances / race conditions
//!
//! ## Out of Scope Threats (not mitigated)
//! - Malware already executing arbitrary code as the same NT user
//! - Injection into the GUI process
//! - Kernel exploits / UAC bypass chains / compromised host

use anyhow::{Result, bail};
use tracing::{debug, error, info, warn};
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
use windows::Win32::Security::TOKEN_QUERY;
use windows::Win32::Security::{
    ACCESS_ALLOWED_ACE, ACE_HEADER, ACL, ACL_REVISION, AddAce, GetLengthSid, GetTokenInformation,
    InitializeAcl, InitializeSecurityDescriptor, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES,
    SECURITY_DESCRIPTOR, SetSecurityDescriptorDacl, TOKEN_USER, TokenUser,
};
use windows::Win32::Storage::FileSystem::{PIPE_ACCESS_DUPLEX, ReadFile, WriteFile};
use windows::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, PIPE_READMODE_BYTE, PIPE_TYPE_BYTE,
    PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows::core::PCWSTR;

use fit_launcher_ipc::{
    Command, Event, ExclusionAction, ExclusionCleanupPolicy, decode_message, encode_message,
};

use crate::defender::folder_exclusion;
use crate::installer::InstallerRunner;
use crate::utils::encode_utf16le_with_null;

const BUFFER_SIZE: u32 = 65536;

/// Generic read/write/execute for pipes (0x1F01FF = PIPE_ALL_ACCESS equivalent)
const PIPE_ALL_ACCESS: u32 = 0x1F01FF;

pub struct IpcServer {
    pipe_name: String,
    pipe_handle: HANDLE,
    read_buffer: Vec<u8>,
    pending_data: Vec<u8>,
}

impl IpcServer {
    /// Creates pipe with user-SID-restricted DACL.
    ///
    /// Only the current NT user can connect. This blocks:
    /// - Other local users
    /// - SYSTEM / service accounts  
    /// - Processes running under different user sessions
    pub fn new(pipe_name: &str) -> Result<Self> {
        let pipe_wide: Vec<u16> = encode_utf16le_with_null(pipe_name);

        // Get current process token to extract user SID
        let mut token_handle = HANDLE::default();
        unsafe {
            OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token_handle)?;
        }

        // Query token for user SID
        let mut token_user_buf = vec![0u8; 256];
        let mut return_length = 0u32;
        unsafe {
            GetTokenInformation(
                token_handle,
                TokenUser,
                Some(token_user_buf.as_mut_ptr() as *mut _),
                token_user_buf.len() as u32,
                &mut return_length,
            )?;
            CloseHandle(token_handle)?;
        }

        let token_user = unsafe { &*(token_user_buf.as_ptr() as *const TOKEN_USER) };
        let user_sid = token_user.User.Sid;
        let sid_len = unsafe { GetLengthSid(user_sid) } as usize;

        // Build ACL with single ACE granting access to current user only
        // ACL header (8 bytes) + ACE header (4 bytes) + access mask (4 bytes) + SID
        let ace_size = std::mem::size_of::<ACE_HEADER>() + std::mem::size_of::<u32>() + sid_len;
        let acl_size = std::mem::size_of::<ACL>() + ace_size;
        let mut acl_buf = vec![0u8; acl_size];
        let acl_ptr = acl_buf.as_mut_ptr() as *mut ACL;

        unsafe {
            InitializeAcl(acl_ptr, acl_size as u32, ACL_REVISION)?;
        }

        // Build ACCESS_ALLOWED_ACE manually: header + mask + SID
        let mut ace_buf = vec![0u8; ace_size];
        let ace = ace_buf.as_mut_ptr() as *mut ACCESS_ALLOWED_ACE;
        unsafe {
            (*ace).Header.AceType = 0; // ACCESS_ALLOWED_ACE_TYPE
            (*ace).Header.AceFlags = 0;
            (*ace).Header.AceSize = ace_size as u16;
            (*ace).Mask = PIPE_ALL_ACCESS;
            // Copy SID after the Mask field
            std::ptr::copy_nonoverlapping(
                user_sid.0 as *const u8,
                &mut (*ace).SidStart as *mut u32 as *mut u8,
                sid_len,
            );
        }

        unsafe {
            AddAce(
                acl_ptr,
                ACL_REVISION,
                u32::MAX,
                ace_buf.as_ptr() as *const _,
                ace_size as u32,
            )?;
        }

        // Create security descriptor with our restricted DACL
        let mut sd = SECURITY_DESCRIPTOR::default();
        unsafe {
            InitializeSecurityDescriptor(PSECURITY_DESCRIPTOR(&mut sd as *mut _ as *mut _), 1)?;
            SetSecurityDescriptorDacl(
                PSECURITY_DESCRIPTOR(&mut sd as *mut _ as *mut _),
                true,
                Some(acl_ptr),
                false,
            )?;
        }

        let sa = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: &mut sd as *mut _ as *mut _,
            bInheritHandle: false.into(),
        };

        let handle = unsafe {
            CreateNamedPipeW(
                PCWSTR(pipe_wide.as_ptr()),
                PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                PIPE_UNLIMITED_INSTANCES,
                BUFFER_SIZE,
                BUFFER_SIZE,
                0,
                Some(&sa),
            )
        };

        if handle == INVALID_HANDLE_VALUE {
            bail!("Failed to create named pipe: {}", pipe_name);
        }

        info!("Created named pipe: {}", pipe_name);

        Ok(Self {
            pipe_name: pipe_name.to_string(),
            pipe_handle: handle,
            read_buffer: vec![0u8; BUFFER_SIZE as usize],
            pending_data: Vec::new(),
        })
    }

    pub fn run(&mut self) -> Result<()> {
        info!("Waiting for client connection...");

        let connected = unsafe { ConnectNamedPipe(self.pipe_handle, None) };
        if connected.is_err() {
            let err = std::io::Error::last_os_error();
            // ERROR_PIPE_CONNECTED (535) means client connected before we called ConnectNamedPipe
            if err.raw_os_error() != Some(535) {
                bail!("Failed to connect pipe: {}", err);
            }
        }

        info!("Client connected!");
        self.send_event(&Event::Ready)?;

        let mut installer: Option<InstallerRunner> = None;

        loop {
            match self.receive_command() {
                Ok(Some(cmd)) => {
                    debug!("Received command: {:?}", cmd);
                    if self.handle_command(cmd, &mut installer)? {
                        break;
                    }
                }
                Ok(None) => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                Err(e) => {
                    if e.to_string().contains("pipe has been ended") {
                        info!("Pipe closed by client");
                        break;
                    }
                    warn!("Error receiving command: {:#}", e);
                }
            }
        }

        Ok(())
    }

    /// Returns true if server should shut down.
    fn handle_command(
        &self,
        cmd: Command,
        installer: &mut Option<InstallerRunner>,
    ) -> Result<bool> {
        match cmd {
            Command::Ping => {
                self.send_event(&Event::Pong)?;
            }
            Command::StartInstall {
                job_id,
                setup_path,
                install_path,
                options,
            } => {
                info!(
                    "Starting installation: job={}, setup={}, install={}",
                    job_id, setup_path, install_path
                );

                let runner =
                    InstallerRunner::new(job_id.clone(), setup_path, install_path, options);

                match runner.run(|event| self.send_event(event)) {
                    Ok(()) => info!("Installation completed: job={}", job_id),
                    Err(e) => {
                        error!("Installation failed: job={}, error={:#}", job_id, e);
                        self.send_event(&Event::Completed {
                            job_id: job_id.clone(),
                            success: false,
                            install_path: None,
                            error: Some(e.to_string()),
                        })?;
                    }
                }

                *installer = Some(runner);
            }
            Command::CancelInstall { job_id } => {
                info!("Cancellation requested: job={}", job_id);
                if let Some(runner) = installer {
                    runner.cancel();
                }
            }
            Command::FolderExclusion { action } => {
                info!("Folder Exclusion Action: {action}");

                match folder_exclusion(action) {
                    Ok(res) => {
                        info!(
                            "Folder exclusion successful: action={:?}, path={}",
                            res.action, res.path
                        );
                        self.send_event(&Event::FolderExclusionResult {
                            success: true,
                            error: None,
                        })?;
                    }
                    Err(err) => {
                        error!("Folder exclusion failed: {:?}", err);

                        self.send_event(&Event::FolderExclusionResult {
                            success: false,
                            error: Some(err.to_string()),
                        })?;

                        return Err(anyhow::anyhow!(err));
                    }
                }
            }
            Command::Shutdown => {
                info!("Shutdown requested");
                self.send_event(&Event::ShuttingDown)?;
                return Ok(true);
            }
            Command::ShutdownIfIdle => {
                if installer.is_none() {
                    info!("ShutdownIfIdle: no active install, shutting down");
                    self.send_event(&Event::ShuttingDown)?;
                    return Ok(true);
                }
            }
            Command::CleanupPolicy { exclusion_folder } => {
                info!("Folder Exclusion Action: {exclusion_folder}");
                let action = match exclusion_folder {
                    ExclusionCleanupPolicy::Keep(_) => None,
                    ExclusionCleanupPolicy::RemoveAfterInstall(s) => {
                        Some(ExclusionAction::Remove(s))
                    }
                };
                if let Some(action) = action {
                    match folder_exclusion(action) {
                        Ok(res) => {
                            info!(
                                "Folder exclusion successful: action={:?}, path={}",
                                res.action, res.path
                            );
                            self.send_event(&Event::FolderExclusionResult {
                                success: true,
                                error: None,
                            })?;
                        }
                        Err(err) => {
                            error!("Folder exclusion failed: {:?}", err);

                            self.send_event(&Event::FolderExclusionResult {
                                success: false,
                                error: Some(err.to_string()),
                            })?;

                            return Err(anyhow::anyhow!(err));
                        }
                    }
                } else {
                    info!("Folder  will be kept in excluded list");
                }
            }
        }

        Ok(false)
    }

    fn send_event(&self, event: &Event) -> Result<()> {
        let data = encode_message(event)?;
        let mut written = 0u32;

        let result = unsafe { WriteFile(self.pipe_handle, Some(&data), Some(&mut written), None) };
        if result.is_err() {
            bail!(
                "Failed to write to pipe: {}",
                std::io::Error::last_os_error()
            );
        }
        // FlushFileBuffers unnecessary for named pipes and can deadlock

        debug!("Sent event: {:?} ({} bytes)", event, written);
        Ok(())
    }

    /// Blocking read - waits for data or pipe close.
    fn receive_command(&mut self) -> Result<Option<Command>> {
        if let Some((cmd, consumed)) = decode_message::<Command>(&self.pending_data)? {
            self.pending_data.drain(..consumed);
            return Ok(Some(cmd));
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

        if result.is_err() {
            bail!(
                "Failed to read from pipe: {}",
                std::io::Error::last_os_error()
            );
        }

        if bytes_read == 0 {
            bail!("pipe has been ended");
        }

        self.pending_data
            .extend_from_slice(&self.read_buffer[..bytes_read as usize]);

        if let Some((cmd, consumed)) = decode_message::<Command>(&self.pending_data)? {
            self.pending_data.drain(..consumed);
            return Ok(Some(cmd));
        }

        Ok(None)
    }
}

impl Drop for IpcServer {
    fn drop(&mut self) {
        info!("Closing pipe: {}", self.pipe_name);
        unsafe {
            let _ = DisconnectNamedPipe(self.pipe_handle);
            let _ = CloseHandle(self.pipe_handle);
        }
    }
}
