//! niri-switch entrypoint.
//!
//! If called with `--toggle`, signals the running daemon to show/hide the overlay
//! via a local Unix socket, then exits immediately.
//! Otherwise, starts the full Tauri daemon.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|a| a == "--toggle") {
        // Signal the running daemon — it listens on a local socket
        if let Err(e) = send_toggle_signal() {
            eprintln!("niri-switch: could not signal daemon: {e}");
            std::process::exit(1);
        }
        return;
    }

    niri_switch_lib::run();
}

fn send_toggle_signal() -> anyhow::Result<()> {
    use std::io::Write;
    use std::os::unix::net::UnixStream;

    let path = toggle_socket_path();
    let mut stream = UnixStream::connect(&path)?;
    stream.write_all(b"toggle\n")?;
    Ok(())
}

fn toggle_socket_path() -> std::path::PathBuf {
    // Derive the path from the real UID so it's consistent whether called
    // from a terminal (XDG_RUNTIME_DIR set) or systemd service (may not be set).
    // /run/user/<uid> is always available on systemd-based Linux regardless of env.
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
