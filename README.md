# niri-overlay

A fast, keyboard-driven window and workspace switcher overlay for the [Niri](https://github.com/YaLTeR/niri) Wayland compositor.

## Features

- Live workspace sidebar with window counts
- Window grid with real system app icons (XDG icon theme)
- Floating window indicators
- Urgent window highlighting
- Full keyboard navigation (arrows, Enter, M, Del, 1–9)
- Search across windows and workspaces
- Move windows between workspaces
- Zero-latency toggle via Unix socket daemon
- Persistent daemon — starts once with your session

## Requirements

- [Niri](https://github.com/YaLTeR/niri) compositor
- Rust toolchain (`rustup`)
- Tauri v2 system dependencies

### Tauri system dependencies (Arch/CachyOS)

```bash
sudo pacman -S webkit2gtk-4.1 libayatana-appindicator gtk3
```

## Building

```bash
git clone https://github.com/viewerofall/niri-switch
cd niri-switch/src-tauri
cargo build --release
sudo cp target/release/niri-switch /usr/local/bin/
```

## Setup

### 1. Systemd user service

Create `~/.config/systemd/user/niri-switch.service`:

```ini
[Unit]
Description=niri-switch overlay daemon
PartOf=graphical-session.target
After=graphical-session.target

[Service]
ExecStart=/usr/local/bin/niri-switch
Restart=on-failure
RestartSec=2
Environment=RUST_LOG=warn
Environment=XDG_RUNTIME_DIR=/run/user/%U

[Install]
WantedBy=graphical-session.target
```

Enable and start it:

```bash
systemctl --user enable --now niri-switch
```

### 2. Niri keybind

Add to `~/.config/niri/config.kdl`:

```kdl
binds {
    Mod+Tab { spawn "/usr/local/bin/niri-switch" "--toggle"; }
}
```

Reload your Niri config and you're done.

## Usage

| Key | Action |
|-----|--------|
| `Mod+Tab` | Toggle overlay (via keybind) |
| `←` `→` | Navigate windows |
| `↑` `↓` | Navigate workspaces |
| `Enter` | Focus selected window |
| `M` | Move window to workspace |
| `Del` | Close window |
| `1`–`9` | Jump to workspace |
| `Esc` | Close overlay |
| Click | Focus window |
| Double-click workspace | Switch to workspace |

## App name overrides

Edit `src/lib/app-names.js` to add or change display names and icons for any app. Keys match against the full app ID or the last dot-segment:

```js
export const APP_NAMES = {
  "my.custom.app": { name: "My App", icon: "🚀" },
  // ...
};
```

## Project structure

```
niri-switch/
├── src/                    # Frontend (vanilla JS, no bundler)
│   ├── index.html          # Entry point with inlined CSS
│   ├── main.js             # App init, event stream
│   └── lib/
│       ├── render.js       # UI rendering, keyboard nav
│       ├── store.js        # Reactive state store
│       └── app-names.js    # App ID → display name mapping
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point, --toggle handler
│   │   ├── lib.rs          # Tauri setup, toggle socket daemon
│   │   ├── commands/       # Tauri IPC commands
│   │   └── ipc/            # Niri IPC client + types
│   ├── Cargo.toml
│   └── tauri.conf.json
└── scripts/
    ├── gen_icons.py        # Generate app icons
    └── get_fonts.py        # Copy JetBrains Mono from system
```

## License

MIT
