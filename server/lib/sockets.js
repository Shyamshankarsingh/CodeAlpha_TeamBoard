import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { hashToken } from './tokens.js';
import { nowIso } from './time.js';
import { events } from './events.js';
import { permissions } from './permissions.js';
import { logger } from '../logger.js';
import { SESSION_COOKIE_NAME } from '../middleware/session.js';

let io = null;
let eventSubscription = null;

// In-memory presence map: projectId -> Map(userId, { user, count, lastSeen })
const projectPresence = new Map();

export function initSockets(httpServer, config) {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like same-origin or non-browser test agents)
        if (!origin) return callback(null, true);
        const allowedOrigins = [config.APP_ORIGIN];
        if (config.NODE_ENV !== 'production') {
          allowedOrigins.push('http://localhost', 'http://127.0.0.1');
        }
        const isAllowed = allowedOrigins.some(
          (allowed) => origin === allowed || origin.startsWith(allowed + ':')
        );
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error('ORIGIN_NOT_ALLOWED'));
        }
      },
      credentials: true,
    },
    maxHttpBufferSize: 1e6, // 1MB packet limit
  });

  // Handshake Authentication & Origin Middleware
  io.use((socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin) {
        const allowedOrigins = [config.APP_ORIGIN];
        if (config.NODE_ENV !== 'production') {
          allowedOrigins.push('http://localhost', 'http://127.0.0.1');
        }
        const isAllowed = allowedOrigins.some(
          (allowed) => origin === allowed || origin.startsWith(allowed + ':')
        );
        if (!isAllowed) {
          return next(new Error('ORIGIN_NOT_ALLOWED'));
        }
      }

      const cookies = parseCookie(socket.handshake.headers.cookie || '');
      const rawToken = cookies[SESSION_COOKIE_NAME];
      if (!rawToken) {
        return next(new Error('UNAUTHORIZED'));
      }

      const sessionId = hashToken(rawToken);
      const db = getDb();
      const row = db
        .prepare(
          `SELECT 
            s.id, s.user_id, s.expires_at, s.last_seen_at,
            u.email, u.name, u.avatar_path, u.locked_until
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.id = ?`
        )
        .get(sessionId);

      if (!row) {
        return next(new Error('UNAUTHORIZED'));
      }

      const now = Date.now();
      const expiresAt = new Date(row.expires_at).getTime();
      const lastSeenAt = new Date(row.last_seen_at).getTime();
      const idleMax = lastSeenAt + config.SESSION_IDLE_DAYS * 24 * 60 * 60 * 1000;

      if (now > expiresAt || now > idleMax) {
        return next(new Error('UNAUTHORIZED'));
      }

      if (row.locked_until && new Date(row.locked_until).getTime() > now) {
        return next(new Error('UNAUTHORIZED'));
      }

      socket.user = {
        id: row.user_id,
        email: row.email,
        name: row.name,
        avatarUrl: row.avatar_path ? `/uploads/avatars/${row.avatar_path}` : null,
      };
      socket.sessionId = row.id;

      next();
    } catch (err) {
      logger.error('Socket authentication error', { error: err.message });
      next(new Error('UNAUTHORIZED'));
    }
  });

  // Socket Connection Lifecycle
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const sessionId = socket.sessionId;

    // Auto-join personal and session rooms
    socket.join(`user:${userId}`);
    socket.join(`session:${sessionId}`);

    // Auto-join all workspace rooms for this user
    try {
      const db = getDb();
      const memberships = db
        .prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ?')
        .all(userId);
      for (const m of memberships) {
        socket.join(`workspace:${m.workspace_id}`);
      }
    } catch (err) {
      logger.error('Error auto-joining workspace rooms', { error: err.message });
    }

    const joinedProjects = new Set();

    // Control Event 1: project:join
    socket.on('project:join', (payload, callback) => {
      try {
        const projectId = payload?.projectId;
        if (!projectId || typeof projectId !== 'string') {
          if (typeof callback === 'function') callback({ success: false, error: 'BAD_REQUEST' });
          return;
        }

        const db = getDb();
        const project = db
          .prepare('SELECT id, workspace_id, visibility FROM projects WHERE id = ?')
          .get(projectId);

        if (!project) {
          if (typeof callback === 'function') callback({ success: false, error: 'NOT_FOUND' });
          return;
        }

        const wsMember = db
          .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
          .get(project.workspace_id, userId);

        if (!wsMember) {
          if (typeof callback === 'function') callback({ success: false, error: 'NOT_FOUND' });
          return;
        }

        const projMember = db
          .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
          .get(projectId, userId);

        const canView = permissions.canViewProject(
          wsMember.role,
          project.visibility,
          Boolean(projMember)
        );

        if (!canView) {
          // WSK-6: Private project leak prevention
          if (typeof callback === 'function') callback({ success: false, error: 'FORBIDDEN' });
          return;
        }

        const room = `project:${projectId}`;
        socket.join(room);
        joinedProjects.add(projectId);

        // Presence tracking (WSK-15: Multi-tab deduplication)
        let presences = projectPresence.get(projectId);
        if (!presences) {
          presences = new Map();
          projectPresence.set(projectId, presences);
        }

        const existing = presences.get(userId);
        const isFirstTab = !existing;
        if (existing) {
          existing.count += 1;
          existing.lastSeen = Date.now();
        } else {
          presences.set(userId, {
            user: socket.user,
            count: 1,
            lastSeen: Date.now(),
          });
        }

        if (isFirstTab) {
          io.to(room).emit('presence:joined', {
            projectId,
            user: socket.user,
            ts: nowIso(),
          });
        }

        const currentUsers = Array.from(presences.values()).map((p) => p.user);
        if (typeof callback === 'function') {
          callback({ success: true, presence: currentUsers });
        }
      } catch (err) {
        logger.error('Error in project:join', { error: err.message });
        if (typeof callback === 'function') callback({ success: false, error: 'INTERNAL_ERROR' });
      }
    });

    // Control Event 2: project:leave
    socket.on('project:leave', (payload, callback) => {
      try {
        const projectId = payload?.projectId;
        if (!projectId) return;

        leaveProjectRoom(socket, projectId);
        joinedProjects.delete(projectId);

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // Control Event 3: presence:ping
    socket.on('presence:ping', (payload) => {
      const projectId = payload?.projectId;
      if (!projectId || !joinedProjects.has(projectId)) return;

      const presences = projectPresence.get(projectId);
      if (presences) {
        const entry = presences.get(userId);
        if (entry) entry.lastSeen = Date.now();
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      for (const projectId of joinedProjects) {
        leaveProjectRoom(socket, projectId);
      }
      joinedProjects.clear();
    });
  });

  setupEventBridge();
  return io;
}

function leaveProjectRoom(socket, projectId) {
  const room = `project:${projectId}`;
  socket.leave(room);

  const presences = projectPresence.get(projectId);
  if (!presences) return;

  const entry = presences.get(socket.user.id);
  if (!entry) return;

  entry.count -= 1;
  if (entry.count <= 0) {
    presences.delete(socket.user.id);
    if (presences.size === 0) {
      projectPresence.delete(projectId);
    }
    if (io) {
      io.to(room).emit('presence:left', {
        projectId,
        userId: socket.user.id,
        ts: nowIso(),
      });
    }
  }
}

function extractData(payload) {
  const { workspaceId, projectId, actorId, originClientId, data, ...rest } = payload;
  return rest;
}

function setupEventBridge() {
  if (eventSubscription) return;

  eventSubscription = ({ type, payload = {} }) => {
    if (!io) return;

    // Convert dot notation to colon notation
    const socketEventType = type.replace(/\./g, ':');

    // Handle session revocation (logout / session deleted) -> WSK-8
    if (type === 'session.revoked' && payload.sessionId) {
      disconnectSessionSockets(payload.sessionId);
      return;
    }

    if (type === 'user.sessions_revoked' && payload.userId) {
      disconnectUserSockets(payload.userId);
      return;
    }

    // Handle project membership revocation -> WSK-7
    if (type === 'project.member_removed' && payload.userId && payload.projectId) {
      removeUserFromProjectRoom(payload.userId, payload.projectId);
    }

    // Handle workspace membership revocation
    if (type === 'workspace.member_removed' && payload.userId && payload.workspaceId) {
      removeUserFromWorkspaceRooms(payload.userId, payload.workspaceId);
    }

    const envelope = {
      eventId: randomUUID(),
      type: socketEventType,
      workspaceId: payload.workspaceId || null,
      projectId: payload.projectId || null,
      actorId: payload.actorId || null,
      originClientId: payload.originClientId || null,
      ts: nowIso(),
      data: payload.data !== undefined ? payload.data : extractData(payload),
    };

    if (payload.projectId) {
      io.to(`project:${payload.projectId}`).emit(socketEventType, envelope);
    } else if (payload.workspaceId) {
      io.to(`workspace:${payload.workspaceId}`).emit(socketEventType, envelope);
    } else if (payload.userId) {
      io.to(`user:${payload.userId}`).emit(socketEventType, envelope);
    }
  };

  events.on('*', eventSubscription);
}

export function disconnectSessionSockets(sessionId) {
  if (!io) return;
  io.in(`session:${sessionId}`).disconnectSockets(true);
}

export function disconnectUserSockets(userId) {
  if (!io) return;
  io.in(`user:${userId}`).disconnectSockets(true);
}

export function removeUserFromProjectRoom(userId, projectId) {
  if (!io) return;
  const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
  if (userRoom) {
    for (const socketId of userRoom) {
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        leaveProjectRoom(s, projectId);
      }
    }
  }
}

export function removeUserFromWorkspaceRooms(userId, workspaceId) {
  if (!io) return;
  const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
  if (userRoom) {
    for (const socketId of userRoom) {
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        s.leave(`workspace:${workspaceId}`);
      }
    }
  }
}

export function getIo() {
  return io;
}

export function closeSockets() {
  if (eventSubscription) {
    events.removeListener('*', eventSubscription);
    eventSubscription = null;
  }
  if (io) {
    io.close();
    io = null;
  }
  projectPresence.clear();
}
