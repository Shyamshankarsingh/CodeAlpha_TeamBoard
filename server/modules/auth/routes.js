import { Router } from 'express';
import { authService } from './service.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
} from './schema.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, setSessionCookie, clearSessionCookie } from '../../middleware/session.js';
import { loginRateLimit, authRateLimit } from '../../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    const result = await authService.register({
      email,
      name,
      password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (result.requiresVerification) {
      return res.status(202).json({
        data: { message: 'Verification link sent if eligible' },
      });
    }

    setSessionCookie(res, result.rawSessionToken, result.sessionExpiresAt);
    res.status(201).json({
      data: {
        user: result.user,
        csrfToken: result.csrfToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', loginRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({
      email,
      password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    setSessionCookie(res, result.rawSessionToken, result.sessionExpiresAt);
    res.status(200).json({
      data: {
        user: result.user,
        csrfToken: result.csrfToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await authService.logout(req.session.id);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const data = await authService.getMe(req.user, req.session.csrfToken);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/verify-email', validate(verifyEmailSchema), async (req, res, next) => {
  try {
    await authService.verifyEmail(req.body.token);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.post('/resend-verification', requireAuth, authRateLimit, async (req, res, next) => {
  try {
    await authService.resendVerification(req.user);
    res.status(202).json({ data: { message: 'Verification email sent' } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', authRateLimit, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);
    res.status(202).json({ data: { message: 'Password reset link sent if account exists' } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    await authService.resetPassword({
      rawToken: req.body.token,
      newPassword: req.body.newPassword,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.post('/change-password', requireAuth, validate(changePasswordSchema), async (req, res, next) => {
  try {
    await authService.changePassword({
      userId: req.user.id,
      currentSessionId: req.session.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/sessions', requireAuth, (req, res, next) => {
  try {
    const sessions = authService.listSessions(req.user.id, req.session.id);
    res.status(200).json({ data: sessions });
  } catch (err) {
    next(err);
  }
});

authRouter.delete('/sessions/:id', requireAuth, (req, res, next) => {
  try {
    authService.revokeSession(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.post('/sessions/revoke-others', requireAuth, (req, res, next) => {
  try {
    authService.revokeOtherSessions(req.user.id, req.session.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
