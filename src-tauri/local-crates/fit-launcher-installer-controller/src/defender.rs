use std::{os::windows::process::CommandExt, path::Path};

use serde::{Deserialize, Serialize};
use thiserror::Error;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExclusionAction {
    Add(String),
    Remove(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExclusionCleanupPolicy {
    Keep(String),
    RemoveAfterInstall(String),
}

impl std::fmt::Display for ExclusionCleanupPolicy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Keep(p) => write!(f, "Keep: {p}"),
            Self::RemoveAfterInstall(p) => write!(f, "RemoveAfterInstall: {p}"),
        }
    }
}

impl std::fmt::Display for ExclusionAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Add(p) => write!(f, "Add: {p}"),
            Self::Remove(p) => write!(f, "Remove: {p}"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Error)]
pub enum ExclusionError {
    #[error("Windows Defender is inactive")]
    DefenderInactive,
    #[error("Path {0} does not exist")]
    PathDoesNotExist(String),
    #[error("PowerShell failed with error: {0}")]
    PowerShellFailed(String),
    #[error("UAC rights were denied")]
    UacDenied,
    #[error("Unexpected error: {0}")]
    Unexpected(String),
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PathResult {
    pub path: String,
    pub action: ExclusionAction,
}

pub fn folder_exclusion(action: ExclusionAction) -> Result<PathResult, ExclusionError> {
    let (dir, ps_cmd) = match &action {
        ExclusionAction::Add(p) => (p, "Add-MpPreference"),
        ExclusionAction::Remove(p) => (p, "Remove-MpPreference"),
    };

    let abs_path = Path::new(dir)
        .canonicalize()
        .map_err(|_| ExclusionError::PathDoesNotExist(dir.clone()))?;

    if !abs_path.exists() {
        return Err(ExclusionError::PathDoesNotExist(dir.clone()));
    }

    let check = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-MpPreference | Out-Null",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| ExclusionError::Unexpected(e.to_string()))?;

    if !check.success() {
        return Err(ExclusionError::DefenderInactive);
    }

    let escaped_path = abs_path.to_string_lossy().replace('\'', "''");
    let full_cmd = format!("{ps_cmd} -ExclusionPath '{}'", escaped_path);

    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &full_cmd])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| ExclusionError::Unexpected(e.to_string()))?;

    if !status.success() {
        return Err(ExclusionError::Unexpected(
            "PowerShell command failed".into(),
        ));
    }

    Ok(PathResult {
        path: abs_path.to_string_lossy().to_string(),
        action,
    })
}
