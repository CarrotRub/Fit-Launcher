//! Named Pipe server for receiving commands from the GUI.

use anyhow::{Result, bail};
use tracing::{debug, error, info, warn};
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
use windows::Win32::Security::{
    InitializeSecurityDescriptor, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, SECURITY_DESCRIPTOR,
    SetSecurityDescriptorDacl,
};
use windows::Win32::Storage::FileSystem::{PIPE_ACCESS_DUPLEX, ReadFile, WriteFile};
use windows::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, PIPE_READMODE_BYTE, PIPE_TYPE_BYTE,
    PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
};
use windows::core::PCWSTR;

use crate::installer::InstallerRunner;
use crate::ipc::protocol::{Command, Event, decode_message, encode_message};

const BUFFER_SIZE: u32 = 65536;

pub struct IpcServer {
    pipe_name: String,
    pipe_handle: HANDLE,
    read_buffer: Vec<u8>,
    pending_data: Vec<u8>,
}

impl IpcServer {
    /// Creates pipe with NULL DACL so non-elevated clients can connect to elevated server.
    pub fn new(pipe_name: &str) -> Result<Self> {
        let pipe_wide: Vec<u16> = pipe_name.encode_utf16().chain(std::iter::once(0)).collect();

        let mut sd = SECURITY_DESCRIPTOR::default();
        unsafe {
            InitializeSecurityDescriptor(PSECURITY_DESCRIPTOR(&mut sd as *mut _ as *mut _), 1)?;
            SetSecurityDescriptorDacl(
                PSECURITY_DESCRIPTOR(&mut sd as *mut _ as *mut _),
                true,
                None,
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

                match runner.run(|event| self.send_event(&event)) {
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
