import { getDb } from '../../db/index.js';

export const workspacesRepo = {
  createWorkspace({ id, name, createdBy }) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO workspaces (id, name, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, createdBy, now, now);
    return this.findWorkspaceById(id);
  },

  findWorkspaceById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  },

  updateWorkspace(id, name) {
    const db = getDb();
    db.prepare(`
      UPDATE workspaces
      SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(name, id);
    return this.findWorkspaceById(id);
  },

  deleteWorkspace(id) {
    const db = getDb();
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  },

  // Membership
  addMember({ workspaceId, userId, role }) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?)
    `).run(workspaceId, userId, role, now);
  },

  findMembership(workspaceId, userId) {
    const db = getDb();
    return db.prepare(`
      SELECT wm.workspace_id, wm.user_id, wm.role, wm.joined_at, u.name, u.email
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ? AND wm.user_id = ?
    `).get(workspaceId, userId);
  },

  listUserWorkspaces(userId) {
    const db = getDb();
    return db.prepare(`
      SELECT w.id, w.name, wm.role, w.created_at
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ?
      ORDER BY w.name ASC
    `).all(userId);
  },

  countOwners(workspaceId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT COUNT(*) as count
      FROM workspace_members
      WHERE workspace_id = ? AND role = 'owner'
    `).get(workspaceId);
    return row.count;
  },

  updateMemberRole(workspaceId, userId, newRole) {
    const db = getDb();
    db.prepare(`
      UPDATE workspace_members
      SET role = ?
      WHERE workspace_id = ? AND user_id = ?
    `).run(newRole, workspaceId, userId);
  },

  removeMember(workspaceId, userId) {
    const db = getDb();
    db.prepare(`
      DELETE FROM workspace_members
      WHERE workspace_id = ? AND user_id = ?
    `).run(workspaceId, userId);
  },

  listMembers(workspaceId, { page = 1, pageSize = 25, q = null }) {
    const db = getDb();
    const offset = (page - 1) * pageSize;
    let where = 'WHERE wm.workspace_id = ?';
    const params = [workspaceId];

    if (q) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      ${where}
    `).get(...params);

    const rows = db.prepare(`
      SELECT wm.user_id, wm.role, wm.joined_at, u.name, u.email, u.avatar_path
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      ${where}
      ORDER BY 
        CASE wm.role 
          WHEN 'owner' THEN 1 
          WHEN 'admin' THEN 2 
          WHEN 'member' THEN 3 
          ELSE 4 
        END,
        u.name ASC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return {
      members: rows,
      total: countRow.total,
      page,
      pageSize,
    };
  },

  // Invitations
  createInvitation({ id, workspaceId, email, role, tokenHash, invitedBy, expiresAt }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, invited_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, workspaceId, email, role, tokenHash, invitedBy, expiresAt);
  },

  findActiveInvitationByHash(tokenHash) {
    const db = getDb();
    const now = new Date().toISOString();
    return db.prepare(`
      SELECT * FROM workspace_invitations
      WHERE token_hash = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
    `).get(tokenHash, now);
  },

  findPendingInvitationByEmail(workspaceId, email) {
    const db = getDb();
    const now = new Date().toISOString();
    return db.prepare(`
      SELECT * FROM workspace_invitations
      WHERE workspace_id = ? AND email = ? COLLATE NOCASE AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
    `).get(workspaceId, email, now);
  },

  listPendingInvitations(workspaceId) {
    const db = getDb();
    const now = new Date().toISOString();
    return db.prepare(`
      SELECT id, email, role, created_at, expires_at
      FROM workspace_invitations
      WHERE workspace_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
    `).all(workspaceId, now);
  },

  revokeInvitation(id, workspaceId) {
    const db = getDb();
    db.prepare(`
      UPDATE workspace_invitations
      SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND workspace_id = ?
    `).run(id, workspaceId);
  },

  markInvitationAccepted(id) {
    const db = getDb();
    db.prepare(`
      UPDATE workspace_invitations
      SET accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(id);
  },

  listMyPendingInvitations(email) {
    const db = getDb();
    const now = new Date().toISOString();
    return db.prepare(`
      SELECT wi.id, wi.role, wi.expires_at, w.name as workspace_name, w.id as workspace_id
      FROM workspace_invitations wi
      JOIN workspaces w ON wi.workspace_id = w.id
      WHERE wi.email = ? COLLATE NOCASE AND wi.accepted_at IS NULL AND wi.revoked_at IS NULL AND wi.expires_at > ?
    `).all(email, now);
  },
};
