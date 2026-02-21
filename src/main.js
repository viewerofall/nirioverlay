// With withGlobalTauri: true, Tauri injects its API as window.__TAURI__
// No bundler or bare imports needed.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWebviewWindow } = window.__TAURI__.webviewWindow;

import { renderApp } from "./lib/render.js";
import { store } from "./lib/store.js";

async function init() {
  const state = await invoke("get_state");
  store.setState(state);

  await listen("niri://event", ({ payload }) => {
    store.applyEvent(payload);
  });

  renderApp(document.getElementById("app"), store);

  const win = getCurrentWebviewWindow();
  await win.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      const input = document.getElementById("search-input");
      if (input) {
        input.value = "";
        const s = store.getState();
        s._query = "";
        store.setState(s);
        setTimeout(() => input.focus(), 30);
      }
    }
  });
}

init().catch(console.error);
