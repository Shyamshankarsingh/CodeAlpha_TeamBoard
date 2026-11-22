/**
 * Client-side Socket.IO management module.
 * Implements:
 * - Handshake connection with cookie auth
 * - Dynamic project room join/leave
 * - Client echo suppression (originClientId vs per-tab clientId)
 * - 200-item LRU event deduplication
 * - Version guarding
 * - Presence tracking & 30s ping heartbeat
 * - Reconnect convergence
 */

const clientId =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'tab-' + Math.random().toString(36).substring(2) + Date.now().toString(36);

export function getClientId() {
  return clientId;
}

const DEDUP_MAX = 200;
const seenEventIds = new Set();
const seenEventOrder = [];

export function isDuplicateEvent(eventId) {
  if (!eventId) return false;
  if (seenEventIds.has(eventId)) return true;
  seenEventIds.add(eventId);
  seenEventOrder.push(eventId);
  if (seenEventOrder.length > DEDUP_MAX) {
    const oldest = seenEventOrder.shift();
    seenEventIds.delete(oldest);
  }
  return false;
}

const entityVersions = new Map();

export function isStaleVersion(entityId, version) {
  if (!entityId || version === undefined || version === null) return false;
  const current = entityVersions.get(entityId);
  if (current !== undefined && version <= current) {
    return true;
  }
  entityVersions.set(entityId, version);
  return false;
}

export function isEcho(originClientId) {
  return Boolean(originClientId && originClientId === clientId);
}

let socket = null;
let activeProjectId = null;
let presencePingInterval = null;
const projectListeners = new Set();
const presenceListeners = new Set();
let currentPresenceList = [];

function notifyPresenceListeners(presenceList) {
  currentPresenceList = presenceList || [];
  for (const fn of presenceListeners) {
    try {
      fn(currentPresenceList);
    } catch (err) {
      console.error('Error in presence listener', err);
    }
  }
}

function notifyPresenceChange(type, data) {
  if (type === 'joined' && data.user) {
    const exists = currentPresenceList.some((u) => u.id === data.user.id);
    if (!exists) {
      currentPresenceList = [...currentPresenceList, data.user];
      notifyPresenceListeners(currentPresenceList);
    }
  } else if (type === 'left' && data.userId) {
    currentPresenceList = currentPresenceList.filter((u) => u.id !== data.userId);
    notifyPresenceListeners(currentPresenceList);
  }
}

function handleIncomingEvent(envelope) {
  if (!envelope) return;

  // 1. Echo suppression (WSK-10)
  if (isEcho(envelope.originClientId)) {
    return;
  }

  // 2. LRU deduplication (WSK-11)
  if (isDuplicateEvent(envelope.eventId)) {
    return;
  }

  // 3. Version guarding (WSK-12)
  const entityId =
    envelope.data?.id || envelope.data?.taskId || envelope.data?.columnId || envelope.data?.boardId;
  if (entityId && envelope.data?.version !== undefined) {
    if (isStaleVersion(entityId, envelope.data.version)) {
      return;
    }
  }

  // 4. Dispatch to subscribers
  for (const listener of projectListeners) {
    try {
      listener(envelope);
    } catch (e) {
      console.error('Error in project socket listener', e);
    }
  }
}

const DOMAIN_EVENTS = [
  'project:updated',
  'project:deleted',
  'board:updated',
  'column:created',
  'column:updated',
  'column:moved',
  'column:deleted',
  'task:created',
  'task:updated',
  'task:moved',
  'task:deleted',
  'subtask:created',
  'subtask:updated',
  'subtask:deleted',
  'comment:created',
  'comment:updated',
  'comment:deleted',
  'notification:new',
  'notification:read',
  'notification:read_all',
];

export const socketClient = {
  getClientId,
  isDuplicateEvent,
  isStaleVersion,
  isEcho,

  connect() {
    if (socket) return socket;
    if (typeof window === 'undefined' || typeof window.io !== 'function') {
      return null;
    }

    socket = window.io({
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      // Reconnect convergence (WSK-13): Re-join project room and refetch presence
      if (activeProjectId) {
        socket.emit('project:join', { projectId: activeProjectId }, (res) => {
          if (res?.success && res.presence) {
            notifyPresenceListeners(res.presence);
          }
        });
      }
    });

    socket.on('disconnect', () => {
      clearInterval(presencePingInterval);
    });

    socket.on('presence:joined', (data) => {
      if (data.projectId === activeProjectId) {
        notifyPresenceChange('joined', data);
      }
    });

    socket.on('presence:left', (data) => {
      if (data.projectId === activeProjectId) {
        notifyPresenceChange('left', data);
      }
    });

    for (const evName of DOMAIN_EVENTS) {
      socket.on(evName, (envelope) => {
        handleIncomingEvent(envelope);
      });
    }

    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    clearInterval(presencePingInterval);
    presencePingInterval = null;
    activeProjectId = null;
    currentPresenceList = [];
    projectListeners.clear();
    presenceListeners.clear();
  },

  joinProject(projectId, callbacks = {}) {
    activeProjectId = projectId;
    if (callbacks.onEvent) projectListeners.add(callbacks.onEvent);
    if (callbacks.onPresence) presenceListeners.add(callbacks.onPresence);

    const s = this.connect();
    if (s) {
      s.emit('project:join', { projectId }, (res) => {
        if (res?.success && res.presence) {
          notifyPresenceListeners(res.presence);
        }
      });

      clearInterval(presencePingInterval);
      presencePingInterval = setInterval(() => {
        if (socket && activeProjectId) {
          socket.emit('presence:ping', { projectId: activeProjectId });
        }
      }, 30000);
    }
  },

  leaveProject(projectId) {
    if (socket && projectId) {
      socket.emit('project:leave', { projectId });
    }
    if (activeProjectId === projectId) {
      activeProjectId = null;
      clearInterval(presencePingInterval);
      presencePingInterval = null;
      currentPresenceList = [];
    }
    projectListeners.clear();
    presenceListeners.clear();
  },

  onProjectEvent(fn) {
    projectListeners.add(fn);
    return () => projectListeners.delete(fn);
  },

  onPresence(fn) {
    presenceListeners.add(fn);
    return () => presenceListeners.delete(fn);
  },
};
