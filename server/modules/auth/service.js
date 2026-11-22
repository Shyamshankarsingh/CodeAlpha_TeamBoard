import { getDb } from '../../db/index.js';
import { authRepo } from './repo.js';
import { hashPassword, verifyPassword, needsRehash, dummyVerify } from '../../lib/passwords.js';
import { generateToken, hashToken } from '../../lib/tokens.js';
import { generateId } from '../../lib/ids.js';
import { addDays, isExpired, nowIso } from '../../lib/time.js';
import { AppError } from '../../lib/errors.js';
import { mailer } from '../../lib/mailer/console.js';
import { config } from '../../config.js';

export const authService = {
  async register({ email, name, password, ip = null, userAgent = null }) {
    const existing = authRepo.findUserByEmail(email);

    if (existing) {
      if (config.REQUIRE_EMAIL_VERIFICATION) {
        // Enforce enumeration resistance
        await mailer.sendEmail({
          to: email,
          subject: 'TeamBoard registration attempt',
          text: `Someone attempted to register an account with this email. If this was you, you already have an account. Log in at ${config.APP_ORIGIN}/login`,
        });
        return {
          requiresVerification: true,
          user: null,
          rawSessionToken: null,
          csrfToken: null,
        };
      }

      throw new AppError('ALREADY_EXISTS', 409, 'An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    const userId = generateId();
    const rawSessionToken = generateToken();
    const sessionId = hashToken(rawSessionToken);
    const csrfToken = generateToken();
    const sessionExpiresAt = addDays(new Date(), config.SESSION_MAX_DAYS);

    const db = getDb();
    let user;

    const executeRegistration = db.transact(() => {
      user = authRepo.createUser({
        id: userId,
        email,
        passwordHash,
        name,
      });

      authRepo.createSession({
        id: sessionId,
        userId,
        csrfToken,
        expiresAt: sessionExpiresAt,
        ip,
        userAgent,
      });

      if (config.REQUIRE_EMAIL_VERIFICATION) {
        const verifyToken = generateToken();
        const verifyTokenHash = hashToken(verifyToken);
        const verifyTokenExpires = addDays(new Date(), 1);

        authRepo.createAuthToken({
          id: generateId(),
          userId,
          type: 'email_verify',
          tokenHash: verifyTokenHash,
          expiresAt: verifyTokenExpires,
        });

        db.afterCommit(() => {
          mailer.sendEmail({
            to: email,
            subject: 'Verify your TeamBoard email',
            text: `Please verify your email: ${config.APP_ORIGIN}/verify?token=${verifyToken}`,
          });
        });
      }
    });

    executeRegistration();

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        theme: user.theme,
      },
      rawSessionToken,
      sessionExpiresAt,
      csrfToken,
    };
  },

  async login({ email, password, ip = null, userAgent = null }) {
    const user = authRepo.findUserByEmail(email);

    if (!user) {
      await dummyVerify();
      throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // Check account lockout
    if (user.locked_until && !isExpired(user.locked_until)) {
      throw new AppError('RATE_LIMITED', 429, 'Account is temporarily locked. Please try again later.');
    }

    const isValid = await verifyPassword(user.password_hash, password);

    if (!isValid) {
      const failedCount = (user.failed_login_count || 0) + 1;
      let lockedUntil = null;

      if (failedCount >= 5) {
        // Lock for 15 minutes
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      authRepo.recordFailedLogin(user.id, failedCount, lockedUntil);
      throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // Password valid, reset failure count
    if (user.failed_login_count > 0 || user.locked_until) {
      authRepo.resetFailedLogin(user.id);
    }

    // Check if hash needs upgrade
    if (needsRehash(user.password_hash)) {
      const newHash = await hashPassword(password);
      authRepo.updatePasswordHash(user.id, newHash);
    }

    // Rotate session token
    const rawSessionToken = generateToken();
    const sessionId = hashToken(rawSessionToken);
    const csrfToken = generateToken();
    const sessionExpiresAt = addDays(new Date(), config.SESSION_MAX_DAYS);

    authRepo.createSession({
      id: sessionId,
      userId: user.id,
      csrfToken,
      expiresAt: sessionExpiresAt,
      ip,
      userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        theme: user.theme,
      },
      rawSessionToken,
      sessionExpiresAt,
      csrfToken,
    };
  },

  async logout(sessionId) {
    if (sessionId) {
      authRepo.deleteSession(sessionId);
    }
  },

  async getMe(user, csrfToken) {
    return {
      user,
      csrfToken,
      workspaces: [], // Extended in Phase 3
    };
  },

  async verifyEmail(rawToken) {
    const tokenHash = hashToken(rawToken);
    const authToken = authRepo.findActiveAuthToken(tokenHash, 'email_verify');

    if (!authToken) {
      throw new AppError('BAD_REQUEST', 400, 'Invalid or expired verification token');
    }

    const db = getDb();
    const executeVerify = db.transact(() => {
      authRepo.setEmailVerified(authToken.user_id);
      authRepo.markAuthTokenUsed(authToken.id);
    });

    executeVerify();
  },

  async resendVerification(user) {
    if (!user || user.emailVerifiedAt) {
      return;
    }

    const verifyToken = generateToken();
    const verifyTokenHash = hashToken(verifyToken);
    const verifyTokenExpires = addDays(new Date(), 1);

    authRepo.createAuthToken({
      id: generateId(),
      userId: user.id,
      type: 'email_verify',
      tokenHash: verifyTokenHash,
      expiresAt: verifyTokenExpires,
    });

    await mailer.sendEmail({
      to: user.email,
      subject: 'Verify your TeamBoard email',
      text: `Please verify your email: ${config.APP_ORIGIN}/verify?token=${verifyToken}`,
    });
  },

  async forgotPassword(email) {
    const user = authRepo.findUserByEmail(email);

    if (user) {
      const resetToken = generateToken();
      const resetTokenHash = hashToken(resetToken);
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      authRepo.createAuthToken({
        id: generateId(),
        userId: user.id,
        type: 'password_reset',
        tokenHash: resetTokenHash,
        expiresAt: resetTokenExpires,
      });

      await mailer.sendEmail({
        to: user.email,
        subject: 'Reset your TeamBoard password',
        text: `Reset your password at: ${config.APP_ORIGIN}/reset-password?token=${resetToken}`,
      });
    }

    // Always return neutral response to prevent email enumeration
    return true;
  },

  async resetPassword({ rawToken, newPassword }) {
    const tokenHash = hashToken(rawToken);
    const authToken = authRepo.findActiveAuthToken(tokenHash, 'password_reset');

    if (!authToken) {
      throw new AppError('BAD_REQUEST', 400, 'Invalid or expired password reset token');
    }

    const newHash = await hashPassword(newPassword);
    const db = getDb();

    const executeReset = db.transact(() => {
      authRepo.updatePasswordHash(authToken.user_id, newHash);
      // Invalidate all existing sessions for this user
      authRepo.deleteAllSessions(authToken.user_id);
      authRepo.markAuthTokenUsed(authToken.id);
    });

    executeReset();
  },

  async changePassword({ userId, currentSessionId, currentPassword, newPassword }) {
    const user = authRepo.findUserById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }

    const isValid = await verifyPassword(user.password_hash, currentPassword);
    if (!isValid) {
      throw new AppError('INVALID_CREDENTIALS', 401, 'Current password is incorrect');
    }

    const newHash = await hashPassword(newPassword);
    const db = getDb();

    const executeChange = db.transact(() => {
      authRepo.updatePasswordHash(userId, newHash);
      // Revoke all other sessions but preserve the current active session
      authRepo.deleteOtherSessions(userId, currentSessionId);
    });

    executeChange();
  },

  listSessions(userId, currentSessionId) {
    const rows = authRepo.listUserSessions(userId);
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
      ip: r.ip,
      userAgent: r.user_agent,
      current: r.id === currentSessionId,
    }));
  },

  revokeSession(userId, sessionId) {
    const session = authRepo.findSessionById(sessionId);
    if (!session || session.user_id !== userId) {
      throw new AppError('NOT_FOUND', 404, 'Session not found');
    }
    authRepo.deleteSession(sessionId);
  },

  revokeOtherSessions(userId, currentSessionId) {
    authRepo.deleteOtherSessions(userId, currentSessionId);
  },
};
