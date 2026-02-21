use std::sync::Arc;
use tauri::State;
use niri_ipc::{Action, WorkspaceReferenceArg};

use crate::ipc::{NiriRequest, NiriState};

pub struct AppState {
    pub client: Arc<crate::ipc::NiriClient>,
}

// ── State ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_state(state: State<'_, AppState>) -> Result<NiriState, String> {
    let s: tokio::sync::RwLockReadGuard<'_, NiriState> = state.client.state.read().await;
    Ok(s.clone())
}

// ── Window actions ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn focus_window(id: u64, state: State<'_, AppState>) -> Result<(), String> {
    state.client
    .request(NiriRequest::Action(Action::FocusWindow { id }))
    .await.map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_window(id: u64, state: State<'_, AppState>) -> Result<(), String> {
    state.client
    .request(NiriRequest::Action(Action::CloseWindow { id: Some(id) }))
    .await.map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn move_window_to_workspace(
    window_id: u64,
    workspace_index: u8,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.client
    .request(NiriRequest::Action(Action::MoveWindowToWorkspace {
        window_id: Some(window_id),
                                 reference: WorkspaceReferenceArg::Index(workspace_index),
                                 focus: false,
    }))
    .await.map(|_| ()).map_err(|e| e.to_string())
}

// ── Workspace actions ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn focus_workspace(index: u8, state: State<'_, AppState>) -> Result<(), String> {
    state.client
    .request(NiriRequest::Action(Action::FocusWorkspace {
        reference: WorkspaceReferenceArg::Index(index),
    }))
    .await.map(|_| ()).map_err(|e| e.to_string())
}

// ── App icon resolution ───────────────────────────────────────────────────────
// Finds the icon file via XDG icon theme lookup, reads it, and returns
// a base64 data URI so the webview can display it without needing
// filesystem access permissions.

#[tauri::command]
pub async fn get_app_icon(app_id: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let path = find_icon_path(&app_id)
    .ok_or_else(|| format!("no icon found for {app_id}"))?;

    let ext = path.extension()
    .and_then(|e| e.to_str())
    .unwrap_or("png")
    .to_lowercase();

    let mime = match ext.as_str() {
        "svg" | "svgz" => "image/svg+xml",
        "png"          => "image/png",
        "xpm"          => "image/x-xpixmap",
        _              => "image/png",
    };

    let bytes = std::fs::read(&path)
    .map_err(|e| format!("failed to read icon {}: {e}", path.display()))?;

    let b64 = STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

fn find_icon_path(app_id: &str) -> Option<std::path::PathBuf> {
    let lower = app_id.to_lowercase();
    let last = lower.split('.').last().unwrap_or(&lower).to_string();
    let candidates = [
        lower.clone(),
        last.clone(),
        last.replace("-desktop", ""),
        last.replace("-bin", ""),
    ];

    let home = std::env::var("HOME").unwrap_or_default();
    let data_dirs = std::env::var("XDG_DATA_DIRS")
    .unwrap_or_else(|_| "/usr/local/share:/usr/share".into());

    let mut icon_bases: Vec<std::path::PathBuf> = vec![
        std::path::PathBuf::from(format!("{home}/.local/share/icons")),
        std::path::PathBuf::from(format!("{home}/.icons")),
    ];
    for d in data_dirs.split(':') {
        icon_bases.push(std::path::PathBuf::from(format!("{d}/icons")));
    }
    icon_bases.push(std::path::PathBuf::from("/usr/share/pixmaps"));

    // Size preference: scalable SVGs first, then largest raster sizes
    let size_dirs = [
        "scalable/apps",
        "256x256/apps", "256x256@2/apps",
        "128x128/apps", "128x128@2/apps",
        "64x64/apps",
        "48x48/apps",
        "32x32/apps",
    ];
    let themes = ["hicolor", "breeze", "Adwaita", "AdwaitaLegacy", "Papirus", "gnome"];
    let extensions = ["svg", "png", "xpm"];

    for candidate in &candidates {
        for base in &icon_bases {
            if !base.exists() { continue; }
            for theme in &themes {
                for size_dir in &size_dirs {
                    for ext in &extensions {
                        let p = base.join(theme).join(size_dir)
                        .join(format!("{candidate}.{ext}"));
                        if p.exists() { return Some(p); }
                    }
                }
            }
            // Flat pixmaps dir
            for ext in &extensions {
                let p = base.join(format!("{candidate}.{ext}"));
                if p.exists() { return Some(p); }
            }
        }

        // Parse .desktop file for Icon= field
        if let Some(icon_name) = find_desktop_icon(candidate) {
            if icon_name != *candidate {
                if let Some(p) = find_icon_path(&icon_name) {
                    return Some(p);
                }
            }
        }
    }
    None
}

/// Parse the Icon= field from a .desktop file for the given app name.
fn find_desktop_icon(app_name: &str) -> Option<String> {
    let data_dirs = std::env::var("XDG_DATA_DIRS")
    .unwrap_or_else(|_| "/usr/local/share:/usr/share".into());
    let home = std::env::var("HOME").unwrap_or_default();

    let mut search_dirs = vec![
        format!("{home}/.local/share/applications"),
    ];
    for d in data_dirs.split(':') {
        search_dirs.push(format!("{d}/applications"));
    }

    for dir in search_dirs {
        // Try exact name and name.desktop
        for filename in [
            format!("{app_name}.desktop"),
                format!("{}.desktop", app_name.to_lowercase()),
        ] {
            let path = std::path::Path::new(&dir).join(&filename);
            if let Ok(content) = std::fs::read_to_string(&path) {
                for line in content.lines() {
                    if let Some(icon) = line.strip_prefix("Icon=") {
                        let icon = icon.trim().to_string();
                        if !icon.is_empty() {
                            return Some(icon);
                        }
                    }
                }
            }
        }
        // Also scan all .desktop files for matching Exec= or Name=
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.extension().and_then(|e| e.to_str()) != Some("desktop") { continue; }
                let Ok(content) = std::fs::read_to_string(&p) else { continue };
                let mut icon_val = None;
                let mut matches = false;
                for line in content.lines() {
                    if let Some(v) = line.strip_prefix("Icon=") { icon_val = Some(v.trim().to_string()); }
                    if let Some(v) = line.strip_prefix("Exec=") {
                        if v.to_lowercase().contains(app_name) { matches = true; }
                    }
                    if let Some(v) = line.strip_prefix("StartupWMClass=") {
                        if v.to_lowercase() == app_name { matches = true; }
                    }
                }
                if matches {
                    if let Some(icon) = icon_val { return Some(icon); }
                }
            }
        }
    }
    None
}

// ── Icon debug helper ─────────────────────────────────────────────────────────
// Run: RUST_LOG=debug ./niri-switch 2>&1 | grep icon
// to see exactly where it searched and what it found/missed.

#[tauri::command]
pub async fn debug_icon_search(app_id: String) -> Result<Vec<String>, String> {
    let lower = app_id.to_lowercase();
    let last = lower.split('.').last().unwrap_or(&lower).to_string();

    let home = std::env::var("HOME").unwrap_or_default();
    let data_dirs = std::env::var("XDG_DATA_DIRS")
    .unwrap_or_else(|_| "/usr/local/share:/usr/share".into());

    let mut searched = vec![
        format!("HOME={home}"),
            format!("XDG_DATA_DIRS={data_dirs}"),
                format!("candidates: {lower}, {last}"),
    ];

    let mut icon_bases: Vec<std::path::PathBuf> = vec![
        std::path::PathBuf::from(format!("{home}/.local/share/icons")),
        std::path::PathBuf::from(format!("{home}/.icons")),
    ];
    for d in data_dirs.split(':') {
        icon_bases.push(std::path::PathBuf::from(format!("{d}/icons")));
        icon_bases.push(std::path::PathBuf::from(format!("{d}/pixmaps")));
    }
    icon_bases.push(std::path::PathBuf::from("/usr/share/pixmaps"));

    // Report which base dirs actually exist
    for base in &icon_bases {
        searched.push(format!("base {} exists={}", base.display(), base.exists()));
    }

    // List actual theme dirs inside each base that exists
    for base in &icon_bases {
        if !base.exists() { continue; }
        if let Ok(entries) = std::fs::read_dir(base) {
            let themes: Vec<String> = entries
            .flatten()
            .filter(|e| e.path().is_dir())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
            searched.push(format!("themes in {}: {:?}", base.display(), themes));
        }
    }

    // Check .desktop files
    let mut desktop_dirs = vec![format!("{home}/.local/share/applications")];
    for d in data_dirs.split(':') {
        desktop_dirs.push(format!("{d}/applications"));
    }
    for dir in &desktop_dirs {
        let p = std::path::Path::new(dir);
        if p.exists() {
            searched.push(format!("desktop dir exists: {dir}"));
            // Try to find app_id desktop file
            for name in [format!("{last}.desktop"), format!("{lower}.desktop")] {
                let fp = p.join(&name);
                if fp.exists() {
                    let content = std::fs::read_to_string(&fp).unwrap_or_default();
                    let icon_line = content.lines()
                    .find(|l| l.starts_with("Icon="))
                    .unwrap_or("Icon= NOT FOUND");
                    searched.push(format!("found {name}: {icon_line}"));
                }
            }
        }
    }

    Ok(searched)
}
