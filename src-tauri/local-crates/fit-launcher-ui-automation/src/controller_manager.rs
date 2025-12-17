//! Singleton Controller Manager for the shared elevated installer controller.

use std::collections::{HashSet, VecDeque};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use specta::Type;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::controller_client::{
    ControllerClient, ControllerCommand, ControllerEvent, InstallOptions, find_controller_binary,
    generate_pipe_name,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct QueuedInstallJob {
    pub job_id: Uuid,
    pub slug: String,
    pub setup_path: PathBuf,
    pub install_path: String,
    pub options: InstallOptions,
}

// For UI
#[derive(serde::Serialize, Type)]
pub struct QueueStatus {
    pub queue: Vec<String>,
    pub active: Option<String>,
}

#[derive(Default)]
struct ManagerState {
    client: Option<ControllerClient>,
    pipe_name: Option<String>,
    spawning: bool,
    pending_downloads: HashSet<Uuid>,
    install_queue: VecDeque<QueuedInstallJob>,
    current_install: Option<Uuid>,
    current_install_slug: Option<String>, // For UI
}

// ControllerClient contains Windows HANDLE (raw pointer). Safe across threads
// because we only access through mutex and Windows HANDLEs are thread-safe.
unsafe impl Send for ManagerState {}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Manager
// ─────────────────────────────────────────────────────────────────────────────

static MANAGER: Lazy<ControllerManager> = Lazy::new(|| ControllerManager {
    state: Mutex::new(ManagerState::default()),
});

pub struct ControllerManager {
    state: Mutex<ManagerState>,
}

impl ControllerManager {
    pub fn global() -> &'static ControllerManager {
        &MANAGER
    }

    fn lock_state(&self) -> Result<std::sync::MutexGuard<'_, ManagerState>, String> {
        self.state.lock().map_err(|e| e.to_string())
    }

    /// Spawns the controller if not already running.
    /// Uses `pipe_name.is_some()` as ground truth for controller existence.
    /// A controller may be temporarily unavailable (borrowed via take_client)
    /// but still exists. Presence of pipe means no new elevation is allowed.
    pub fn ensure_running(&self) -> Result<(), String> {
        let should_spawn = {
            let mut state = self.lock_state()?;

            // Pipe exists = controller exists (even if borrowed)
            if state.pipe_name.is_some() {
                return Ok(());
            }

            if state.spawning {
                drop(state);
                return self.wait_for_spawn();
            }

            state.spawning = true;
            true
        };

        if !should_spawn {
            return Ok(());
        }

        self.spawn_controller()
    }

    /// Waits for another thread's spawn attempt to complete.
    fn wait_for_spawn(&self) -> Result<(), String> {
        info!("Another thread is spawning controller, waiting...");

        for _ in 0..60 {
            std::thread::sleep(Duration::from_millis(500));
            let state = self.lock_state()?;

            // Pipe exists = controller exists
            if state.pipe_name.is_some() {
                info!("Controller now available after waiting");
                return Ok(());
            }
            if !state.spawning {
                break;
            }
        }

        let state = self.lock_state()?;
        if state.pipe_name.is_some() {
            return Ok(());
        }

        Err("Controller spawn timed out or failed".to_string())
    }

    /// Actually spawns and connects to the controller.
    /// Lock is NOT held during blocking I/O to avoid deadlocks.
    fn spawn_controller(&self) -> Result<(), String> {
        info!("Spawning shared controller for install pipeline...");

        let controller_path = find_controller_binary().map_err(|e| {
            self.clear_spawning_flag();
            error!("Failed to find controller binary: {:#}", e);
            format!("Controller not found: {}", e)
        })?;

        let pipe_name = generate_pipe_name();
        info!("Using pipe: {}", pipe_name);

        let mut client = ControllerClient::spawn_and_connect(&controller_path, &pipe_name)
            .map_err(|e| {
                self.clear_spawning_flag();
                error!("Failed to spawn controller: {:#}", e);
                format!("Controller spawn failed: {}", e)
            })?;

        match client.recv_timeout(Duration::from_secs(10)) {
            Ok(Some(ControllerEvent::Ready)) => info!("Shared controller is ready"),
            Ok(other) => warn!("Unexpected first event from controller: {:?}", other),
            Err(e) => {
                self.clear_spawning_flag();
                error!("Failed to receive Ready from controller: {:#}", e);
                return Err("Controller did not respond".to_string());
            }
        }

        let mut state = self.lock_state()?;
        state.spawning = false;

        // Check for race (shouldn't happen due to spawning flag, but be defensive)
        if state.client.is_some() {
            info!("Another thread already connected, using existing client");
            return Ok(());
        }

        state.client = Some(client);
        state.pipe_name = Some(pipe_name);
        Ok(())
    }

    fn clear_spawning_flag(&self) {
        if let Ok(mut state) = self.state.lock() {
            state.spawning = false;
        }
    }

    /// Registers a download as pending installation.
    /// Triggers early UAC prompt only if no controller exists yet.
    pub fn register_download(&self, job_id: Uuid) -> Result<(), String> {
        let should_spawn = {
            let mut state = self.lock_state()?;
            state.pending_downloads.insert(job_id);
            info!("Registered download {} for install pipeline", job_id);

            // Pipe exists = controller exists (even if borrowed during automation)
            state.pipe_name.is_none()
        };

        if should_spawn && let Err(e) = self.ensure_running() {
            warn!(
                "Could not pre-start controller (will retry on install): {}",
                e
            );
        }

        Ok(())
    }

    pub fn queue_install(&self, job: QueuedInstallJob) -> Result<(), String> {
        let job_id = job.job_id;
        let mut state = self.lock_state()?;

        state.pending_downloads.remove(&job_id);
        state.install_queue.push_back(job);

        info!(
            "Queued job {} for installation ({} in queue)",
            job_id,
            state.install_queue.len()
        );
        Ok(())
    }

    pub fn cancel_download(&self, job_id: Uuid) -> Result<(), String> {
        let mut state = self.lock_state()?;

        if state.pending_downloads.remove(&job_id) {
            info!("Removed cancelled download {} from pipeline", job_id);
        }

        let before = state.install_queue.len();
        state.install_queue.retain(|j| j.job_id != job_id);
        if state.install_queue.len() < before {
            info!("Removed cancelled job {} from install queue", job_id);
        }

        Ok(())
    }

    pub fn take_next_job(&self) -> Result<Option<QueuedInstallJob>, String> {
        let mut state = self.lock_state()?;

        if state.current_install.is_some() {
            return Ok(None);
        }

        if let Some(job) = state.install_queue.pop_front() {
            state.current_install = Some(job.job_id);
            state.current_install_slug = Some(job.slug.clone()); // For UI
            info!("Starting install for job {} ({})", job.job_id, job.slug);
            Ok(Some(job))
        } else {
            Ok(None)
        }
    }

    /// Atomically claims the next job only if it matches the given ID.
    /// Returns true if claimed, false if busy or not next in queue.
    pub fn take_next_job_if_match(&self, job_id: Uuid) -> Result<bool, String> {
        let mut state = self.lock_state()?;

        if state.current_install.is_some() {
            return Ok(false);
        }

        if let Some(front) = state.install_queue.front()
            && front.job_id == job_id
        {
            let job = state.install_queue.pop_front().unwrap();
            state.current_install = Some(job_id);
            state.current_install_slug = Some(job.slug.clone()); // For UI
            info!("Claiming install slot for job {} ({})", job_id, job.slug);
            return Ok(true);
        }

        Ok(false)
    }

    pub fn complete_current_install(&self) -> Result<(), String> {
        let mut state = self.lock_state()?;

        if let Some(job_id) = state.current_install.take() {
            let slug = state.current_install_slug.take().unwrap_or_default();
            info!("Completed install for job {} ({})", job_id, slug);
        }

        Ok(())
    }

    pub fn send_command(&self, command: &ControllerCommand) -> Result<(), String> {
        let mut state = self.lock_state()?;
        state
            .client
            .as_mut()
            .ok_or("Controller not running")?
            .send_command(command)
            .map_err(|e| e.to_string())
    }

    /// Receives an event with timeout.
    /// WARNING: Holds mutex during blocking I/O. For long-polling, use take_client/put_client.
    pub fn recv_timeout(&self, timeout: Duration) -> Result<Option<ControllerEvent>, String> {
        let mut state = self.lock_state()?;
        state
            .client
            .as_mut()
            .ok_or("Controller not running")?
            .recv_timeout(timeout)
            .map_err(|e| e.to_string())
    }

    /// Takes the client for exclusive use outside the mutex.
    /// MUST call put_client afterward, even on error paths.
    pub fn take_client(&self) -> Result<Option<ControllerClient>, String> {
        Ok(self.lock_state()?.client.take())
    }

    pub fn put_client(&self, client: ControllerClient) -> Result<(), String> {
        self.lock_state()?.client = Some(client);
        Ok(())
    }

    pub fn should_shutdown(&self) -> Result<bool, String> {
        let state = self.lock_state()?;
        Ok(state.pending_downloads.is_empty()
            && state.install_queue.is_empty()
            && state.current_install.is_none())
    }

    pub fn shutdown_if_idle(&self) -> Result<(), String> {
        if !self.should_shutdown()? {
            return Ok(());
        }

        let mut state = self.lock_state()?;
        if let Some(ref mut client) = state.client {
            info!("Shutting down idle controller");
            let _ = client.shutdown();
        }
        state.client = None;
        state.pipe_name = None;
        Ok(())
    }

    // For UI
    pub fn queue_status(&self) -> Result<(Vec<String>, Option<String>), String> {
        let state = self.lock_state()?;
        Ok((
            state
                .install_queue
                .iter()
                .map(|job| job.slug.clone())
                .collect(),
            state.current_install_slug.clone(),
        ))
    }

    // For UI
    pub fn is_running(&self) -> bool {
        self.state
            .lock()
            .map(|s| s.client.is_some())
            .unwrap_or(false)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API (For UI)
// ─────────────────────────────────────────────────────────────────────────────

pub fn get_install_queue_status() -> Result<QueueStatus, String> {
    let (queue, active) = ControllerManager::global().queue_status()?;
    Ok(QueueStatus { queue, active })
}
