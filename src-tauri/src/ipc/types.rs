/// Re-export niri's official IPC types.
pub use niri_ipc::{Event as NiriEvent, Request as NiriRequest, Response as NiriResponse};
pub use niri_ipc::{Window, Workspace};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Socket path ───────────────────────────────────────────────────────────────

pub fn socket_path() -> anyhow::Result<std::path::PathBuf> {
    if let Ok(p) = std::env::var("NIRI_SOCKET") {
        return Ok(p.into());
    }
    let runtime = std::env::var("XDG_RUNTIME_DIR")
    .unwrap_or_else(|_| format!("/run/user/{}", read_uid()));
    Ok(std::path::PathBuf::from(format!("{runtime}/niri/socket")))
}

fn read_uid() -> u32 {
    std::fs::read_to_string("/proc/self/status")
    .ok()
    .and_then(|s| {
        s.lines()
        .find(|l| l.starts_with("Uid:"))
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|uid| uid.parse().ok())
    })
    .unwrap_or(1000)
}

// ── Aggregated state ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NiriState {
    pub workspaces: Vec<Workspace>,
    pub windows_by_workspace: HashMap<u64, Vec<Window>>,
    pub focused_window_id: Option<u64>,
    pub focused_workspace_id: Option<u64>,
}

impl NiriState {
    pub fn total_windows(&self) -> usize {
        self.windows_by_workspace.values().map(Vec::len).sum()
    }
}
