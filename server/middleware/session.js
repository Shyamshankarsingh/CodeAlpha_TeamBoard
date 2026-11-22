import { parseCookie, stringifySetCookie } from 'cookie';
import { getDb } from '../db/index.js';
import { hashToken } from '../lib/tokens.js';
import { nowIso } from '../lib/time.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

export const SESSION_COOKIE_NAME = 'tb_session';

export function sessionMiddleware(req, res, next) {
  req.session = null;
  req.user = null;

  const cookies = parseCookie(req.headers.cookie || '');
  const rawToken = cookies[SESSION_COOKIE_NAME];

  if (!rawToken) {
    return next();
  }

  const sessionId = hashToken(rawToken);
  const db = getDb();

  const row = db
    .prepare(
      `SELECT 
        s.id, s.user_id, s.csrf_token, s.created_at, s.last_seen_at, s.expires_at,
        u.email, u.name, u.timezone, u.theme, u.notification_prefs, u.email_verified_at,
        u.locked_until
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?`
    )
    .get(sessionId);

  if (!row) {
    clearSessionCookie(res);
    return next();
  }

  const now = Date.now();
  const expiresAt = new Date(row.expires_at).getTime();
  const lastSeenAt = new Date(row.last_seen_at).getTime();
  const idleMax = lastSeenAt + config.SESSION_IDLE_DAYS * 24 * 60 * 60 * 1000;

  // Check absolute expiration and idle timeout
  if (now > expiresAt || now > idleMax) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    clearSessionCookie(res);
    return next();
  }

  // Refresh last_seen_at if older than 5 minutes
  if (now - lastSeenAt > 5 * 60 * 1000) {
    const currentIso = nowIso();
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(currentIso, sessionId);
    row.last_seen_at = currentIso;
  }

  req.session = {
    id: row.id,
    userId: row.user_id,
    csrfToken: row.csrf_token,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  };

  let notificationPrefs = {};
  try {
    notificationPrefs = JSON.parse(row.notification_prefs || '{}');
  } catch (e) {}

  req.user = {
    id: row.user_id,
    email: row.email,
    name: row.name,
    timezone: row.timezone,
    theme: row.theme,
    notificationPrefs,
    emailVerifiedAt: row.email_verified_at,
  };

  next();
}

export function requireAuth(req, res, next) {
  if (!req.session || !req.user) {
    throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
  }
  next();
}

export function setSessionCookie(res, rawToken, expiresAt) {
  const isProd = config.NODE_ENV === 'production';
  const cookieHeader = stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: config.COOKIE_SECURE === true || isProd,
    expires: new Date(expiresAt),
  });

  res.setHeader('Set-Cookie', cookieHeader);
}

export function clearSessionCookie(res) {
  const isProd = config.NODE_ENV === 'production';
  const cookieHeader = stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: config.COOKIE_SECURE === true || isProd,
    expires: new Date(0),
  });

  res.setHeader('Set-Cookie', cookieHeader);
}
