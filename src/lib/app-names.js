// App ID → display name + icon mapping.
// Keys are matched against the lowercase app_id, both the full string
// and the last dot-segment (so "org.mozilla.firefox" matches "firefox").
// Add your own overrides here — this is the only file you need to touch.

export const APP_NAMES = {
    // Terminals
    "kitty":                        { name: "Kitty",         icon: "🐱" },
    "alacritty":                    { name: "Alacritty",     icon: "⬛" },
    "foot":                         { name: "Foot",          icon: "🦶" },
    "wezterm":                      { name: "WezTerm",       icon: "💻" },
    "org.wezfurlong.wezterm":       { name: "WezTerm",       icon: "💻" },
    "com.mitchellh.ghostty":        { name: "Ghostty",       icon: "👻" },
    "ghostty":                      { name: "Ghostty",       icon: "👻" },
    "blackbox":                     { name: "Black Box",     icon: "📦" },
    "com.raggesilver.blackbox":     { name: "Black Box",     icon: "📦" },

    // Browsers
    "firefox":                      { name: "Firefox",       icon: "🦊" },
    "org.mozilla.firefox":          { name: "Firefox",       icon: "🦊" },
    "floorp":                       { name: "Floorp",        icon: "🌊" },
    "org.mozilla.floorp":           { name: "Floorp",        icon: "🌊" },
    "chromium":                     { name: "Chromium",      icon: "🌐" },
    "org.chromium.chromium":        { name: "Chromium",      icon: "🌐" },
    "brave-browser":                { name: "Brave",         icon: "🦁" },
    "com.brave.browser":            { name: "Brave",         icon: "🦁" },
    "google-chrome":                { name: "Chrome",        icon: "🔵" },
    "com.google.chrome":            { name: "Chrome",        icon: "🔵" },
    "qutebrowser":                  { name: "qutebrowser",   icon: "⌨️"  },
    "zen":                          { name: "Zen",           icon: "🧘" },
    "app.zen-browser.zen":          { name: "Zen",           icon: "🧘" },

    // Editors / IDEs
    "code":                         { name: "VS Code",       icon: "⚡" },
    "code-oss":                     { name: "VS Code OSS",   icon: "⚡" },
    "com.visualstudio.code":        { name: "VS Code",       icon: "⚡" },
    "neovide":                      { name: "Neovide",       icon: "💚" },
    "nvim":                         { name: "Neovim",        icon: "💚" },
    "neovim":                       { name: "Neovim",        icon: "💚" },
    "helix":                        { name: "Helix",         icon: "🌀" },
    "emacs":                        { name: "Emacs",         icon: "🟣" },
    "zed":                          { name: "Zed",           icon: "⚡" },
    "dev.zed.zed":                  { name: "Zed",           icon: "⚡" },
    "jetbrains-idea":               { name: "IntelliJ",      icon: "🧠" },
    "jetbrains-clion":              { name: "CLion",         icon: "🦁" },
    "jetbrains-rider":              { name: "Rider",         icon: "🎯" },

    // File managers
    "thunar":                       { name: "Thunar",        icon: "📁" },
    "nautilus":                     { name: "Files",         icon: "📁" },
    "org.gnome.nautilus":           { name: "Files",         icon: "📁" },
    "dolphin":                      { name: "Dolphin",       icon: "🐬" },
    "org.kde.dolphin":              { name: "Dolphin",       icon: "🐬" },
    "nemo":                         { name: "Nemo",          icon: "📁" },
    "org.nemo.nemo":                { name: "Nemo",          icon: "📁" },

    // Communication
    "discord":                      { name: "Discord",       icon: "💬" },
    "com.discordapp.discord":       { name: "Discord",       icon: "💬" },
    "vesktop":                      { name: "Vesktop",       icon: "💬" },
    "telegram-desktop":             { name: "Telegram",      icon: "✈️"  },
    "org.telegram.desktop":         { name: "Telegram",      icon: "✈️"  },
    "slack":                        { name: "Slack",         icon: "💼" },
    "com.slack.slack":              { name: "Slack",         icon: "💼" },
    "element":                      { name: "Element",       icon: "🔷" },
    "im.riot.riot":                 { name: "Element",       icon: "🔷" },
    "signal-desktop":               { name: "Signal",        icon: "🔒" },
    "org.signal.signal":            { name: "Signal",        icon: "🔒" },

    // Media
    "spotify":                      { name: "Spotify",       icon: "🎵" },
    "com.spotify.client":           { name: "Spotify",       icon: "🎵" },
    "mpv":                          { name: "mpv",           icon: "▶️"  },
    "io.mpv.mpv":                   { name: "mpv",           icon: "▶️"  },
    "vlc":                          { name: "VLC",           icon: "🎬" },
    "org.videolan.vlc":             { name: "VLC",           icon: "🎬" },
    "rhythmbox":                    { name: "Rhythmbox",     icon: "🎵" },
    "org.gnome.rhythmbox3":         { name: "Rhythmbox",     icon: "🎵" },

    // Graphics / Design
    "gimp":                         { name: "GIMP",          icon: "🎨" },
    "org.gimp.gimp":                { name: "GIMP",          icon: "🎨" },
    "inkscape":                     { name: "Inkscape",      icon: "✒️"  },
    "org.inkscape.inkscape":        { name: "Inkscape",      icon: "✒️"  },
    "blender":                      { name: "Blender",       icon: "🔶" },
    "org.blender.blender":          { name: "Blender",       icon: "🔶" },
    "krita":                        { name: "Krita",         icon: "🖌️"  },
    "org.kde.krita":                { name: "Krita",         icon: "🖌️"  },

    // System
    "pavucontrol":                  { name: "PulseAudio",    icon: "🔊" },
    "org.pulseaudio.pavucontrol":   { name: "PulseAudio",    icon: "🔊" },
    "org.gnome.settings":           { name: "Settings",      icon: "⚙️"  },
    "nm-connection-editor":         { name: "Network",       icon: "🌐" },
    "org.kde.systemsettings":       { name: "Settings",      icon: "⚙️"  },
    "org.kde.plasma-systemmonitor": { name: "System Monitor",icon: "📊" },
    "htop":                         { name: "htop",          icon: "📊" },
    "btop":                         { name: "btop",          icon: "📊" },
};

/**
 * Look up display info for an app_id.
 * Falls back gracefully: full id → last segment → title-cased last segment.
 */
export function resolveApp(appId) {
    if (!appId) return { name: "Unknown", icon: "⬜" };

    const lower = appId.toLowerCase();

    // Exact match
    if (APP_NAMES[lower]) return APP_NAMES[lower];

    // Last dot segment (e.g. "org.mozilla.firefox" → "firefox")
    const last = lower.split(".").pop();
    if (APP_NAMES[last]) return APP_NAMES[last];

    // Fallback: prettify the segment
    const pretty = (last || appId)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

    return { name: pretty, icon: "⬜" };
}
