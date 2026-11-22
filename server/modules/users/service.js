import { usersRepo } from './repo.js';
import { AppError } from '../../lib/errors.js';

export const usersService = {
  updateMe(userId, updates) {
    const updated = usersRepo.updateUser(userId, updates);
    if (!updated) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }

    let notificationPrefs = {};
    try {
      notificationPrefs = JSON.parse(updated.notification_prefs || '{}');
    } catch (e) {}

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatar_path,
      timezone: updated.timezone,
      theme: updated.theme,
      notificationPrefs,
      emailVerifiedAt: updated.email_verified_at,
    };
  },

  getUser(userId) {
    const user = usersRepo.findUserById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }
    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatar_path,
    };
  },

  searchUsers(q, limit = 10) {
    const rows = usersRepo.searchUsers(q, limit);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      avatarUrl: r.avatar_path,
    }));
  },
};
