import { getDb } from '../../db/index.js';

export const usersRepo = {
  findUserById(id) {
    const db = getDb();
    return db.prepare('SELECT id, email, name, avatar_path, timezone, theme, notification_prefs, email_verified_at, created_at FROM users WHERE id = ?').get(id);
  },

  updateUser(id, updates) {
    const db = getDb();
    const sets = [];
    const values = [];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      values.push(updates.name);
    }
    if (updates.timezone !== undefined) {
      sets.push('timezone = ?');
      values.push(updates.timezone);
    }
    if (updates.theme !== undefined) {
      sets.push('theme = ?');
      values.push(updates.theme);
    }
    if (updates.notificationPrefs !== undefined) {
      sets.push('notification_prefs = ?');
      values.push(JSON.stringify(updates.notificationPrefs));
    }

    if (sets.length === 0) {
      return this.findUserById(id);
    }

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
    values.push(id);

    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.findUserById(id);
  },

  searchUsers(query, limit = 10) {
    const db = getDb();
    const pattern = `%${query}%`;
    return db.prepare(`
      SELECT id, name, avatar_path FROM users
      WHERE name LIKE ? OR email LIKE ?
      ORDER BY name ASC
      LIMIT ?
    `).all(pattern, pattern, limit);
  },
};
