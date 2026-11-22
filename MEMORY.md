# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 9 complete and verified. Ready for Phase 10 approval.
- **Code:**
  - Notification System (`/api/notifications`): 9 trigger types (`task_assigned`, `task_unassigned`, `comment_created`, `comment_mention`, `task_due_soon`, `task_overdue`, `project_invitation`, `workspace_invitation`, `role_changed`) with strict actor self-exclusion (`FR-N2`), background reminder and overdue idempotent deduplication (`FR-N3`), preference-aware filtering (`users.notification_prefs`, `FR-N4`).
  - Endpoints: cursor-paginated notification feed (`GET /`), unread badge count (`GET /unread-count`), single read (`POST /:id/read`), mark all read (`POST /read-all`), dismiss notification (`DELETE /:id`).
  - Database migration: `007_notifications.sql` creating `notifications` with partial index for unread queries and composite indexes for feed and deduplication.
  - Frontend UI: Header notification bell with live unread badge, interactive dropdown feed (`public/js/components/notifications-menu.js`) with relative time, type-specific icons, mark read on click, dismiss, and real-time Socket.IO synchronization (`notification:new`, `notification:read`, `notification:read_all`).
- **Tests:** 113 tests passing across 21 suites (`npm test`).
- **Repository:** Phase 9 ready to commit (`phase-9: notification system`).
- **Environment:** Node v26.11.1, npm 11.20.0 on Windows.
- **Documentation:** Up to date.

---

## Phase Checklist

| Phase | Description | Status |
| :--- | :--- | :--- |
| **0** | Foundation, config, health, security headers | Completed |
| **1** | Database architecture, migrations (001), spikes | Completed |
| **2** | Authentication and session management | Completed |
| **3** | Workspace and membership management (002) | Completed |
| **4** | Project management, activity logs, domain events (003) | Completed |
| **5** | Board and column management (004) | Completed |
| **6** | Task management and drag & drop (005) | Completed |
| **7** | Comments and collaboration (006) | Completed |
| **8** | Real-time WebSocket infrastructure (Socket.IO) | Completed |
| **9** | Notification system (007) | Completed |
| **10** | Dashboard and analytics | Ready to begin |
| **11a** | List view, filters, search (MVP) | Not started |
| **11b** | Extras (FTS5 search, attachments, bulk, export) | Not started |
| **12** | Security hardening and comprehensive testing | Not started |
| **13** | Responsive design and UX refinement | Not started |
| **14** | Deployment and production readiness | Not started |
