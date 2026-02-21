import { resolveApp } from "./app-names.js";

const { invoke }          = window.__TAURI__.core;
const { getCurrentWebviewWindow } = window.__TAURI__.webviewWindow;

// ── Keyboard nav state ────────────────────────────────────────────────────────
let _navIndex = 0;
let _navItems = [];

// ── Icon cache ────────────────────────────────────────────────────────────────
// Map<appId, imgSrc | null>  — null means "not found, use fallback"
const _iconCache = new Map();
const _iconLoading = new Set();

// ── Entry point ───────────────────────────────────────────────────────────────

export function renderApp(root, store) {
  root.innerHTML = buildSkeleton();
  bindStaticEvents(root, store);
  renderState(root, store.getState());
  store.subscribe(state => renderState(root, state));
}

function buildSkeleton() {
  return `
  <div id="app">
  <div class="header">
  <div class="header-left">
  <div class="logo"><div class="logo-pip"></div>niri-switch</div>
  </div>
  <div class="header-meta">
  <div class="meta-item"><div class="meta-dot"></div><span>niri</span></div>
  <span id="meta-ws">— / —</span>
  <span id="meta-wins">— windows</span>
  </div>
  </div>

  <div class="search-wrap">
  <div class="search-box">
  <span class="search-icon">⌕</span>
  <input class="search-input" id="search-input"
  placeholder="search windows and workspaces…"
  autocomplete="off" spellcheck="false" />
  <span class="search-hint">Esc close</span>
  </div>
  </div>

  <div class="body">
  <div class="sidebar">
  <div class="sidebar-label">Workspaces</div>
  <div class="ws-list" id="ws-list"></div>
  <div class="ws-add" id="ws-add"><span>+</span> new workspace</div>
  </div>
  <div class="win-area">
  <div class="win-area-header">
  <span class="win-area-title" id="win-area-title">Select a workspace</span>
  <div class="win-area-actions">
  <button class="action-btn active" id="btn-grid">grid</button>
  <button class="action-btn" id="btn-list">list</button>
  </div>
  </div>
  <div class="win-grid" id="win-grid"></div>
  </div>
  </div>

  <div class="niri-strip" id="niri-strip"><span class="strip-label">Layout</span></div>

  <div class="footer">
  <div class="keybinds">
  <div class="kb"><span class="kbd">←→</span> navigate</div>
  <div class="kb"><span class="kbd">↑↓</span> workspace</div>
  <div class="kb"><span class="kbd">Enter</span> focus</div>
  <div class="kb"><span class="kbd">M</span> move</div>
  <div class="kb"><span class="kbd">Del</span> close</div>
  <div class="kb"><span class="kbd">1–9</span> jump</div>
  </div>
  <div class="footer-right">niri IPC</div>
  </div>
  </div>
  <div class="move-popup" id="move-popup" style="display:none"></div>
  `;
}

// ── State rendering ───────────────────────────────────────────────────────────

function renderState(root, state) {
  const q = state._query || "";
  const totalWins = Object.values(state.windows_by_workspace)
  .reduce((a, ws) => a + ws.length, 0);
  const focusedIdx = state.workspaces.findIndex(w => w.is_focused) + 1;

  root.querySelector("#meta-ws").textContent =
  `ws ${focusedIdx || "-"} / ${state.workspaces.length}`;
  root.querySelector("#meta-wins").textContent =
  `${totalWins} window${totalWins !== 1 ? "s" : ""}`;

  renderWorkspaces(root, state, q);
  renderWindows(root, state, q);
  renderStrip(root, state);
  rebuildNavItems(state);
}

// ── Workspaces ────────────────────────────────────────────────────────────────

function renderWorkspaces(root, state, query) {
  const list = root.querySelector("#ws-list");
  const selectedId = state.selected_workspace_id
  || state.focused_workspace_id
  || state.workspaces[0]?.id;

  list.innerHTML = state.workspaces
  .filter(ws => !query ||
  (ws.name || `ws ${ws.idx}`).toLowerCase().includes(query.toLowerCase()))
  .map(ws => {
    const wins = state.windows_by_workspace[ws.id] || [];
    const name = ws.name || `ws ${ws.idx}`;
    const sel = ws.id === selectedId;
    const urgentCount = wins.filter(w => w.is_urgent).length;
    return `
    <div class="ws-item ${sel ? "selected" : ""} ${ws.is_focused ? "focused" : ""}"
    data-ws-id="${ws.id}" data-ws-idx="${ws.idx}">
    <div class="ws-left">
    <span class="ws-index">${ws.idx}</span>
    <span class="ws-name">${escHtml(name)}</span>
    </div>
    <div class="ws-right">
    ${urgentCount ? `<span class="ws-urgent" title="${urgentCount} urgent">!</span>` : ""}
    <span class="ws-badge">${wins.length}</span>
    </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".ws-item").forEach(el => {
    el.addEventListener("click", () => {
      state.selected_workspace_id = Number(el.dataset.wsId);
      renderWorkspaces(root, state, query);
      renderWindows(root, state, query);
      _navIndex = 0;
      rebuildNavItems(state);
    });
    el.addEventListener("dblclick", () => {
      invoke("focus_workspace", { index: Number(el.dataset.wsIdx) })
      .then(() => getCurrentWebviewWindow().hide())
      .catch(console.error);
    });
  });
}

// ── Windows ───────────────────────────────────────────────────────────────────

function renderWindows(root, state, query) {
  const grid = root.querySelector("#win-grid");
  const titleEl = root.querySelector("#win-area-title");

  const selectedId = state.selected_workspace_id
  || state.focused_workspace_id
  || state.workspaces[0]?.id;

  const ws = state.workspaces.find(w => w.id === selectedId);
  const wsName = ws ? (ws.name || `ws ${ws.idx}`) : "unknown";
  let wins = state.windows_by_workspace[selectedId] || [];

  if (query) {
    const q = query.toLowerCase();
    wins = wins.filter(w =>
    (w.title || "").toLowerCase().includes(q) ||
    resolveApp(w.app_id).name.toLowerCase().includes(q) ||
    (w.app_id || "").toLowerCase().includes(q)
    );
  }

  titleEl.innerHTML = `<em>${escHtml(wsName)}</em> &mdash; ${wins.length} window${wins.length !== 1 ? "s" : ""}`;

  if (wins.length === 0) {
    grid.innerHTML = `
    <div class="win-empty">
    <div class="win-empty-icon"></div>
    <span>${query ? "no matches" : "no windows"}</span>
    </div>`;
    return;
  }

  grid.innerHTML = wins.map(win => {
    const { name } = resolveApp(win.app_id);
    const isFocused   = win.id === state.focused_window_id;
    const isNavFocused = _navItems[_navIndex]?.id === win.id;
    const isFloating  = win.is_floating === true;
    const isUrgent    = win.is_urgent === true;
    const cachedIcon  = _iconCache.get(win.app_id);

    // Kick off icon fetch if not cached yet
    if (cachedIcon === undefined && win.app_id && !_iconLoading.has(win.app_id)) {
      fetchIcon(win.app_id, root);
    }

    const iconContent = cachedIcon
    ? `<img class="app-icon-img" src="${cachedIcon}" alt="" />`
    : `<div class="app-icon-placeholder" data-app-id="${escHtml(win.app_id || "")}"></div>`;

    return `
    <div class="win-card
    ${isFocused    ? "focused"     : ""}
    ${isNavFocused ? "nav-focused" : ""}
    ${isUrgent     ? "urgent"      : ""}"
    data-win-id="${win.id}" data-app-id="${escHtml(win.app_id || "")}">
    <div class="win-preview" data-app="${appSlug(win.app_id)}">
    <div class="win-preview-icon-wrap">
    ${iconContent}
    </div>
    ${isFloating ? `<span class="float-badge" title="Floating">⬡</span>` : ""}
    ${isUrgent   ? `<span class="urgent-badge" title="Urgent">!</span>`  : ""}
    ${isFocused  ? `<span class="active-badge">ACTIVE</span>`            : ""}
    </div>
    <div class="win-info">
    <div class="win-name-row">
    <div class="win-title-col">
    <span class="win-app-name">${escHtml(name)}</span>
    <span class="win-title" title="${escHtml(win.title || "")}">${escHtml(truncate(win.title || name, 26))}</span>
    </div>
    </div>
    <div class="win-btns">
    <div class="win-btn move"  data-win-id="${win.id}" title="Move (M)">⇄</div>
    <div class="win-btn close" data-win-id="${win.id}" title="Close (Del)">✕</div>
    </div>
    </div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".win-card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".win-btn")) return;
      invoke("focus_window", { id: Number(card.dataset.winId) })
      .then(() => getCurrentWebviewWindow().hide())
      .catch(console.error);
    });
  });

  grid.querySelectorAll(".win-btn.close").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      invoke("close_window", { id: Number(btn.dataset.winId) }).catch(console.error);
    });
  });

  grid.querySelectorAll(".win-btn.move").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      showMovePopup(btn, Number(btn.dataset.winId), state);
    });
  });
}

// ── Icon loading ──────────────────────────────────────────────────────────────

async function fetchIcon(appId, root) {
  _iconLoading.add(appId);
  try {
    // Rust returns a base64 data URI directly — no asset protocol needed
    const src = await invoke("get_app_icon", { appId });
    _iconCache.set(appId, src);
    // Patch all placeholders for this appId without a full re-render
    root.querySelectorAll(`.app-icon-placeholder[data-app-id="${appId}"]`).forEach(el => {
      const img = document.createElement("img");
      img.className = "app-icon-img";
      img.src = src;
      img.alt = "";
      el.replaceWith(img);
    });
  } catch {
    // No icon found — mark as null so we don't retry
    _iconCache.set(appId, null);
  } finally {
    _iconLoading.delete(appId);
  }
}

// ── Niri strip ────────────────────────────────────────────────────────────────

function renderStrip(root, state) {
  const strip = root.querySelector("#niri-strip");
  const selectedId = state.selected_workspace_id || state.focused_workspace_id;

  strip.innerHTML = `<span class="strip-label">Layout</span>` +
  state.workspaces.map(ws => {
    const wins = state.windows_by_workspace[ws.id] || [];
    return `<div class="strip-col
    ${ws.id === selectedId ? "active" : ""}
    ${wins.length ? "has-wins" : ""}"
    data-ws-idx="${ws.idx}"
    title="ws ${ws.idx}: ${ws.name || "—"} (${wins.length} windows)">
    </div>`;
  }).join("") +
  `<span class="strip-scroll-hint">← scroll →</span>`;

  strip.querySelectorAll(".strip-col").forEach(col => {
    col.addEventListener("click", () => {
      invoke("focus_workspace", { index: Number(col.dataset.wsIdx) })
      .then(() => getCurrentWebviewWindow().hide())
      .catch(console.error);
    });
  });
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

function rebuildNavItems(state) {
  const selectedId = state.selected_workspace_id
  || state.focused_workspace_id
  || state.workspaces[0]?.id;
  _navItems = (state.windows_by_workspace[selectedId] || [])
  .map(w => ({ type: "window", id: w.id }));
}

function navMove(root, state, delta) {
  if (_navItems.length === 0) return;
  _navIndex = (_navIndex + delta + _navItems.length) % _navItems.length;
  root.querySelectorAll(".win-card").forEach(c => c.classList.remove("nav-focused"));
  const item = _navItems[_navIndex];
  if (item) {
    const card = root.querySelector(`.win-card[data-win-id="${item.id}"]`);
    if (card) { card.classList.add("nav-focused"); card.scrollIntoView({ block: "nearest" }); }
  }
}

function navActivate() {
  const item = _navItems[_navIndex];
  if (!item) return;
  invoke("focus_window", { id: item.id })
  .then(() => getCurrentWebviewWindow().hide())
  .catch(console.error);
}

// ── Move popup ────────────────────────────────────────────────────────────────

function showMovePopup(anchor, windowId, state) {
  const popup = document.getElementById("move-popup");
  const rect = anchor.getBoundingClientRect();
  popup.innerHTML = `<div class="move-popup-title">Move to workspace</div>` +
  state.workspaces.map(ws => `
  <div class="move-popup-item" data-ws-idx="${ws.idx}">
  <span class="item-idx">${ws.idx}</span>
  <span>${escHtml(ws.name || `ws ${ws.idx}`)}</span>
  </div>`).join("");

  popup.style.cssText = `display:block; top:${Math.min(rect.bottom + 4, window.innerHeight - 200)}px; left:${Math.max(rect.left - 100, 8)}px;`;

  popup.querySelectorAll(".move-popup-item").forEach(item => {
    item.addEventListener("click", () => {
      invoke("move_window_to_workspace", {
        windowId,
        workspaceIndex: Number(item.dataset.wsIdx),
      }).catch(console.error);
      popup.style.display = "none";
    });
  });

  const close = e => {
    if (!popup.contains(e.target)) {
      popup.style.display = "none";
      document.removeEventListener("click", close, true);
    }
  };
  setTimeout(() => document.addEventListener("click", close, true), 0);
}

// ── Static event binding ──────────────────────────────────────────────────────

export function bindStaticEvents(root, store) {
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      getCurrentWebviewWindow().hide().catch(console.error);
      return;
    }
    if (isSearchFocused()) return;

    const state = store.getState();

    if (e.key === "ArrowRight") { e.preventDefault(); navMove(root, state,  1); return; }
    if (e.key === "ArrowLeft")  { e.preventDefault(); navMove(root, state, -1); return; }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const ws = state.workspaces;
      const idx = ws.findIndex(w => w.id === (state.selected_workspace_id || state.focused_workspace_id));
      if (idx < ws.length - 1) {
        state.selected_workspace_id = ws[idx + 1].id;
        _navIndex = 0;
        renderState(root, state);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const ws = state.workspaces;
      const idx = ws.findIndex(w => w.id === (state.selected_workspace_id || state.focused_workspace_id));
      if (idx > 0) {
        state.selected_workspace_id = ws[idx - 1].id;
        _navIndex = 0;
        renderState(root, state);
      }
      return;
    }

    if (e.key === "Enter")  { e.preventDefault(); navActivate(); return; }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const item = _navItems[_navIndex];
      if (item) invoke("close_window", { id: item.id }).catch(console.error);
      return;
    }

    if (e.key === "m" || e.key === "M") {
      const item = _navItems[_navIndex];
      if (item) {
        const btn = root.querySelector(`.win-card[data-win-id="${item.id}"] .win-btn.move`);
        if (btn) showMovePopup(btn, item.id, state);
      }
      return;
    }

    if (e.key >= "1" && e.key <= "9") {
      invoke("focus_workspace", { index: Number(e.key) })
      .then(() => getCurrentWebviewWindow().hide())
      .catch(console.error);
    }
  });

  const searchInput = root.querySelector("#search-input");
  searchInput.addEventListener("input", () => {
    const s = store.getState();
    s._query = searchInput.value.trim();
    _navIndex = 0;
    renderState(root, s);
  });
  setTimeout(() => searchInput.focus(), 50);

  root.querySelector("#btn-grid").addEventListener("click", () => {
    root.querySelector("#btn-grid").classList.add("active");
    root.querySelector("#btn-list").classList.remove("active");
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function appSlug(appId) {
  return appId ? appId.toLowerCase().split(".").pop() : "unknown";
}
function escHtml(str) {
  return String(str)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}
function isSearchFocused() {
  return document.activeElement?.id === "search-input";
}
