const listeners = new Set();

let state = {
  user: null,
  csrfToken: null,
  theme: localStorage.getItem('tb_theme') || 'system',
  workspaces: [],
  currentWorkspaceId: localStorage.getItem('tb_workspace_id') || null,
  toast: null,
};

function notify() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (e) {
      console.error('Store listener error:', e);
    }
  }
}

export const store = {
  getState() {
    return state;
  },

  setState(partial) {
    state = { ...state, ...partial };
    notify();
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setUser(user, csrfToken) {
    state.user = user;
    state.csrfToken = csrfToken;
    if (user && user.theme) {
      this.setTheme(user.theme);
    }
    notify();
  },

  setCurrentWorkspace(workspaceId) {
    state.currentWorkspaceId = workspaceId;
    if (workspaceId) {
      localStorage.setItem('tb_workspace_id', workspaceId);
    } else {
      localStorage.removeItem('tb_workspace_id');
    }
    notify();
  },

  setTheme(theme) {
    state.theme = theme;
    localStorage.setItem('tb_theme', theme);
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    notify();
  },

  showToast(message, type = 'info', durationMs = 4000) {
    const id = Date.now();
    state.toast = { id, message, type };
    notify();
    setTimeout(() => {
      if (state.toast && state.toast.id === id) {
        state.toast = null;
        notify();
      }
    }, durationMs);
  },
};

// Initialize theme on load
store.setTheme(state.theme);
