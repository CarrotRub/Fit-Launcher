//! IPC Protocol definitions. Messages are JSON with 4-byte LE length prefix.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Commands (GUI → Controller)
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
pub enum Command {
    StartInstall {
        job_id: String,
        setup_path: String,
        install_path: String,
        options: InstallOptions,
    },
    CancelInstall {
        job_id: String,
    },
    Shutdown,
    ShutdownIfIdle,
    Ping,
}

// ─────────────────────────────────────────────────────────────────────────────
// Events (Controller → GUI)
// ─────────────────────────────────────────────────────────────────────────────

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

impl std::fmt::Display for InstallPhase {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SelectLanguage => write!(f, "Selecting Language"),
            Self::Welcome => write!(f, "Welcome"),
            Self::Information => write!(f, "Information"),
            Self::SelectDestination => write!(f, "Select Destination"),
            Self::SelectComponents => write!(f, "Select Components"),
            Self::Preparing => write!(f, "Preparing"),
            Self::Extracting => write!(f, "Extracting"),
            Self::Unpacking => write!(f, "Unpacking"),
            Self::Finalizing => write!(f, "Finalizing"),
            Self::Completed => write!(f, "Completed"),
            Self::Failed => write!(f, "Failed"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
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
    Error {
        job_id: Option<String>,
        message: String,
    },
    ShuttingDown,
}

// ─────────────────────────────────────────────────────────────────────────────
// Wire Format (length-prefixed JSON)
// ─────────────────────────────────────────────────────────────────────────────

pub fn encode_message<T: Serialize>(msg: &T) -> anyhow::Result<Vec<u8>> {
    let json = serde_json::to_vec(msg)?;
    let mut buf = Vec::with_capacity(4 + json.len());
    buf.extend_from_slice(&(json.len() as u32).to_le_bytes());
    buf.extend_from_slice(&json);
    Ok(buf)
}

/// Returns (message, bytes_consumed) or None if incomplete.
pub fn decode_message<T: for<'de> Deserialize<'de>>(
    buf: &[u8],
) -> anyhow::Result<Option<(T, usize)>> {
    if buf.len() < 4 {
        return Ok(None);
    }

    let len = u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]) as usize;
    let total = 4 + len;

    if buf.len() < total {
        return Ok(None);
    }

    Ok(Some((serde_json::from_slice(&buf[4..total])?, total)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_roundtrip() {
        let cmd = Command::StartInstall {
            job_id: "test-123".into(),
            setup_path: r"C:\Games\setup.exe".into(),
            install_path: r"C:\Games\MyGame".into(),
            options: InstallOptions::default(),
        };

        let encoded = encode_message(&cmd).unwrap();
        let (decoded, consumed): (Command, _) = decode_message(&encoded).unwrap().unwrap();

        assert_eq!(consumed, encoded.len());
        if let Command::StartInstall { job_id, .. } = decoded {
            assert_eq!(job_id, "test-123");
        } else {
            panic!("Expected StartInstall");
        }
    }

    #[test]
    fn test_decode_partial() {
        let cmd = Command::Ping;
        let encoded = encode_message(&cmd).unwrap();

        assert!(decode_message::<Command>(&encoded[..3]).unwrap().is_none());
        assert!(decode_message::<Command>(&encoded).unwrap().is_some());
    }
}
