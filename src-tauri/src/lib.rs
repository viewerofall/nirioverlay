use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent,
};
use tracing::info;
use tracing_subscriber::{fmt, EnvFilter};

mod commands;
mod ipc;

use commands::{
    close_window, debug_icon_search, focus_window, focus_workspace,
    get_app_icon, get_state, move_window_to_workspace,
    AppState,
};
use ipc::NiriClient;

// ── Toggle socket path ────────────────────────────────────────────────────────
// niri-switch --toggle connects here and sends a single byte; the daemon
// receives it and shows/hides the overlay.

fn toggle_socket_path() -> std::path::PathBuf {
    let uid = read_uid();
    let runtime = std::env::var("XDG_RUNTIME_DIR")
    .unwrap_or_else(|_| format!("/run/user/{uid}"));
    std::path::PathBuf::from(format!("{runtime}/niri-switch.sock"))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    fmt()
    .with_env_filter(EnvFilter::from_default_env())
    .init();

    let (client, mut event_rx) = NiriClient::new();
    let client = Arc::new(client);
    let client_for_stream = Arc::clone(&client);

    tauri::Builder::default()
    .manage(AppState { client: Arc::clone(&client) })
    .invoke_handler(tauri::generate_handler![
        get_state,
        focus_window,
        focus_workspace,
        move_window_to_workspace,
        close_window,
        get_app_icon,
        debug_icon_search,
    ])
    .setup(move |app| {
        // ── Tray icon ─────────────────────────────────────────────────────
        let quit = MenuItem::with_id(app, "quit", "Quit niri-switch", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&quit])?;

        TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("niri-switch")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event {
                toggle_overlay(&tray.app_handle());
            }
        })
        .on_menu_event(|app, event| {
            if event.id == "quit" { app.exit(0); }
        })
        .build(app)?;

        // ── Niri event stream → frontend ──────────────────────────────────
        let app_handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                let event: ipc::NiriEvent = event;
                let payload = serde_json::to_value(&event).unwrap_or_default();
                let _ = app_handle.emit("niri://event", payload);
            }
        });

        tauri::async_runtime::spawn(async move {
            client_for_stream.run_event_stream().await;
        });

        // ── Toggle socket listener ────────────────────────────────────────
        // Listens for connections on $XDG_RUNTIME_DIR/niri-switch.sock.
        // Any connection (even zero bytes) triggers a toggle.
        let sock_path = toggle_socket_path();
        // Remove stale socket from a previous run
        let _ = std::fs::remove_file(&sock_path);

        let app_handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            use tokio::net::UnixListener;
            match UnixListener::bind(&sock_path) {
                Ok(listener) => {
                    info!("Toggle socket listening at {}", sock_path.display());
                    loop {
                        // Accept and immediately discard — the connection itself is the signal
                        if listener.accept().await.is_ok() {
                            toggle_overlay(&app_handle);
                        }
                    }
                }
                Err(e) => tracing::error!("Failed to bind toggle socket: {e}"),
            }
        });

        info!("niri-switch daemon started");
        Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error building tauri app")
    .run(|app, event| {
        match event {
            RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::CloseRequested { api, .. },
                ..
            } if label == "overlay" => {
                api.prevent_close();
                if let Some(win) = app.get_webview_window("overlay") {
                    let _ = win.hide();
                }
            }
            RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
            }
            _ => {}
        }
    });
}

pub fn toggle_overlay(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("overlay") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}
