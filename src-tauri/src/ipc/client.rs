use std::sync::Arc;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::UnixStream,
    sync::{broadcast, RwLock},
};
use tracing::{error, info, warn};

use super::types::{socket_path, NiriEvent, NiriRequest, NiriResponse, NiriState};

pub struct NiriClient {
    pub state: Arc<RwLock<NiriState>>,
    pub event_tx: broadcast::Sender<NiriEvent>,
}

impl NiriClient {
    pub fn new() -> (Self, broadcast::Receiver<NiriEvent>) {
        let (tx, rx) = broadcast::channel(256);
        let client = Self {
            state: Arc::new(RwLock::new(NiriState::default())),
            event_tx: tx,
        };
        (client, rx)
    }

    pub async fn request(&self, req: NiriRequest) -> anyhow::Result<NiriResponse> {
        let path = socket_path()?;
        let mut stream = UnixStream::connect(&path).await?;
        let payload = serde_json::to_vec(&req)?;
        stream.write_all(&payload).await?;
        stream.write_all(b"\n").await?;
        stream.shutdown().await?;
        let mut reader = BufReader::new(&mut stream);
        let mut line = String::new();
        reader.read_line(&mut line).await?;
        let reply: niri_ipc::Reply = serde_json::from_str(line.trim())?;
        reply.map_err(|e| anyhow::anyhow!("Niri error: {e}"))
    }

    pub async fn run_event_stream(self: Arc<Self>) {
        loop {
            match self.connect_event_stream().await {
                Ok(()) => warn!("Niri event stream ended — reconnecting…"),
                Err(e) => error!("Event stream error: {e} — reconnecting in 2s"),
            }
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    }

    async fn connect_event_stream(&self) -> anyhow::Result<()> {
        let path = socket_path()?;
        let mut stream = UnixStream::connect(&path).await?;
        let req = serde_json::to_vec(&NiriRequest::EventStream)?;
        stream.write_all(&req).await?;
        stream.write_all(b"\n").await?;

        info!("Connected to Niri event stream at {}", path.display());

        let mut reader = BufReader::new(stream);
        let mut line = String::new();

        // First line confirms the event stream started
        reader.read_line(&mut line).await?;
        let reply: niri_ipc::Reply = serde_json::from_str(line.trim())?;
        reply.map_err(|e| anyhow::anyhow!("EventStream rejected: {e}"))?;

        // Niri sends full initial state as the first events automatically —
        // no need for separate Workspaces/Windows requests.
        loop {
            line.clear();
            let n = reader.read_line(&mut line).await?;
            if n == 0 { break; }
            match serde_json::from_str::<NiriEvent>(line.trim()) {
                Ok(event) => {
                    self.apply_event(&event).await;
                    let _ = self.event_tx.send(event);
                }
                Err(e) => warn!("Failed to parse Niri event: {e}\nRaw: {line}"),
            }
        }
        Ok(())
    }

    async fn apply_event(&self, event: &NiriEvent) {
        let mut state = self.state.write().await;
        match event {
            NiriEvent::WorkspacesChanged { workspaces } => {
                // workspaces is a Vec<Workspace> directly
                state.focused_workspace_id = workspaces.iter().find(|w| w.is_focused).map(|w| w.id);
                state.workspaces = workspaces.clone();
            }
            NiriEvent::WorkspaceActivated { id, focused } => {
                let activated_id = *id;
                let is_focused = *focused;
                for ws in &mut state.workspaces {
                    ws.is_active = ws.id == activated_id;
                    if is_focused {
                        ws.is_focused = ws.id == activated_id;
                    }
                }
                if is_focused {
                    state.focused_workspace_id = Some(activated_id);
                }
            }
            NiriEvent::WindowsChanged { windows } => {
                state.windows_by_workspace.clear();
                // windows is a Vec<Window> directly
                state.focused_window_id = windows.iter().find(|w| w.is_focused).map(|w| w.id);
                for win in windows.clone() {
                    let ws_id = win.workspace_id.unwrap_or(0);
                    state.windows_by_workspace.entry(ws_id).or_default().push(win);
                }
            }
            NiriEvent::WindowOpenedOrChanged { window } => {
                let ws_id = window.workspace_id.unwrap_or(0);
                for wins in state.windows_by_workspace.values_mut() {
                    wins.retain(|w| w.id != window.id);
                }
                state.windows_by_workspace.entry(ws_id).or_default().push(window.clone());
            }
            NiriEvent::WindowClosed { id } => {
                for wins in state.windows_by_workspace.values_mut() {
                    wins.retain(|w| w.id != *id);
                }
            }
            NiriEvent::WindowFocusChanged { id } => {
                state.focused_window_id = *id;
                for wins in state.windows_by_workspace.values_mut() {
                    for w in wins.iter_mut() {
                        w.is_focused = Some(w.id) == *id;
                    }
                }
            }
            _ => {}
        }
    }
}
