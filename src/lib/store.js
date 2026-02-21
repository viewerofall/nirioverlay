function createStore() {
  let state = {
    workspaces: [],
    windows_by_workspace: {},
    focused_window_id: null,
    focused_workspace_id: null,
    selected_workspace_id: null,
  };

  const subscribers = new Set();
  function notify() { subscribers.forEach(fn => fn(state)); }

  return {
    getState: () => state,

    setState(newState) {
      state = { ...state, ...newState };
      if (!state.selected_workspace_id && state.focused_workspace_id) {
        state.selected_workspace_id = state.focused_workspace_id;
      }
      notify();
    },

    // niri-ipc serializes events as externally-tagged enums:
    // { "WorkspacesChanged": { workspaces: [...] } }
    // So event is an object with exactly one key — the variant name.
    applyEvent(event) {
      const [variant, data] = Object.entries(event)[0];

      switch (variant) {
        case "WorkspacesChanged":
          state = {
            ...state,
            workspaces: data.workspaces,
            focused_workspace_id:
            data.workspaces.find(w => w.is_focused)?.id ?? state.focused_workspace_id,
          };
          break;

        case "WorkspaceActivated":
          state = {
            ...state,
            workspaces: state.workspaces.map(w => ({
              ...w,
              is_active: w.id === data.id,
              is_focused: data.focused ? w.id === data.id : w.is_focused,
            })),
            focused_workspace_id: data.focused ? data.id : state.focused_workspace_id,
          };
          break;

        case "WindowsChanged": {
          state = {
            ...state,
            windows_by_workspace: groupByWorkspace(data.windows),
            focused_window_id:
            data.windows.find(w => w.is_focused)?.id ?? state.focused_window_id,
          };
          break;
        }

        case "WindowOpenedOrChanged": {
          const win = data.window;
          const wsId = win.workspace_id ?? 0;
          const byWs = { ...state.windows_by_workspace };
          for (const key of Object.keys(byWs)) {
            byWs[key] = byWs[key].filter(w => w.id !== win.id);
          }
          byWs[wsId] = [...(byWs[wsId] ?? []), win];
          state = { ...state, windows_by_workspace: byWs };
          break;
        }

        case "WindowClosed": {
          const byWs = { ...state.windows_by_workspace };
          for (const key of Object.keys(byWs)) {
            byWs[key] = byWs[key].filter(w => w.id !== data.id);
          }
          state = { ...state, windows_by_workspace: byWs };
          break;
        }

        case "WindowFocusChanged":
          state = {
            ...state,
            focused_window_id: data.id ?? null,
            windows_by_workspace: Object.fromEntries(
              Object.entries(state.windows_by_workspace).map(([k, wins]) => [
                k,
                wins.map(w => ({ ...w, is_focused: w.id === data.id })),
              ])
            ),
          };
          break;
      }
      notify();
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

function groupByWorkspace(windows) {
  return windows.reduce((acc, win) => {
    const key = win.workspace_id ?? 0;
    (acc[key] ??= []).push(win);
    return acc;
  }, {});
}

export const store = createStore();
