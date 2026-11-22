# Implementation Plan: TeamBoard

**Status:** Plan only. Implementation proceeds phase by phase upon approval.  
**Related:** [ARCHITECTURE.md](file:///e:/projectanagement/docs/ARCHITECTURE.md), [DATABASE.md](file:///e:/projectanagement/docs/DATABASE.md), [API.md](file:///e:/projectanagement/docs/API.md), [WEBSOCKET.md](file:///e:/projectanagement/docs/WEBSOCKET.md), [SECURITY.md](file:///e:/projectanagement/docs/SECURITY.md), [DECISIONS.md](file:///e:/projectanagement/DECISIONS.md).

---

## 0. Principles & Workflow

- Sequential phases. Each phase concludes in a runnable, tested state and a commit (`phase-N: summary`).
- No parallel application source development.
- Dependencies limited strictly to the approved inventory (ADR-015).
- Domain-event bus introduced in Phase 4; Socket.IO subscriber added in Phase 8 without retrofitting earlier services.

---

## 1. Phase Roadmap

```
0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11a -> 12 -> 13 -> 14
                                                                \-> 11b (post-MVP)
```

---

### Phase 0: Project Foundation and Configuration
- **Objectives:** Running empty app with security headers, config validation, logging, test runner, SPA fallback.
- **Features:** `GET /api/health`, static file serving, error envelope, request IDs.
- **Backend:** `config.js` (env validation via Zod), `logger.js`, `app.js`, `errorHandler`, `notFound`, `securityHeaders` (Helmet + strict CSP), graceful shutdown in `index.js`.
- **Frontend:** `index.html` shell, `main.js` ("TeamBoard is running" with health check status), `tokens.css`, `base.css`.
- **Database:** None.
- **Dependencies:** `express`, `helmet`, `zod`.
- **Acceptance:** `npm test` passes, `npm start` serves the page with verified security headers.

---

### Phase 1: Database Architecture and Migrations
- **Objectives:** Database access, WAL pragmas, migration runner, transaction helper, identity schema (`001_identity.sql`).
- **Features:** Transaction helper with rollback, `afterCommit` queue, ID and time helpers. Spikes for FTS5 and Argon2.
- **Database:** `schema_migrations`, `users`, `sessions`, `auth_tokens`.
- **Dependencies:** `better-sqlite3`.
- **Acceptance:** Fresh checkout builds database from scratch via migration runner; transaction rollback and constraint tests pass.

---

### Phase 2: Authentication and Session Management
- **Objectives:** Secure accounts, session lifecycle, CSRF protection, profile settings.
- **Features:** Register, login, logout, me, email verification, forgot/reset password, session list & revoke, profile updates.
- **Backend:** `modules/auth`, `middleware/session.js`, `csrf.js`, `originCheck.js`, `rateLimit.js`, Argon2id wrapper (with scrypt fallback).
- **Frontend:** `api.js`, `store.js`, `router.js`, auth pages (login, register, reset, settings), minimal app shell.
- **Dependencies:** `argon2` (or scrypt fallback), `cookie`, `express-rate-limit`.
- **Acceptance:** Journeys 1, 2, 18 pass. All mutations without CSRF or with invalid Origin rejected.

---

### Phase 3: Workspace and Membership Management
- **Objectives:** Multi-tenancy, workspace roles, invitations.
- **Features:** Create, update, delete, switch workspaces; member list and role assignment; invite and accept; last-owner invariant.
- **Database:** `002_workspaces.sql` (`workspaces`, `workspace_members`, `workspace_invitations`).
- **Acceptance:** Journeys 3, 4, 5 pass. Server-enforced role restrictions verified.

---

### Phase 4: Project Management
- **Objectives:** Projects, visibility settings, project members, activity feed, domain-event bus.
- **Features:** Project CRUD, archive, visibility (`workspace`/`private`), dates, priority, progress calculation, activity log.
- **Database:** `003_projects.sql` (`projects`, `project_members`, `activity_logs`).
- **Acceptance:** Journeys 6, 16 pass. Private projects invisible to unauthorized users.

---

### Phase 5: Board and Column Management
- **Objectives:** Boards and ordered columns with server-computed fractional ordering.
- **Features:** Default board with 5 columns, add/rename/reorder/delete column (with task relocation), fractional position math.
- **Database:** `004_boards.sql` (`boards`, `board_columns`).
- **Acceptance:** Journeys 7, 8 pass. Randomized position sequence tests stay strictly ordered.

---

### Phase 6: Task Management and Drag & Drop
- **Objectives:** Core product: tasks, assignments, drag-and-drop with optimistic updates.
- **Features:** Task CRUD, move, duplicate, archive, completion via done column, priority, dates, assignees, labels, subtasks, watchers, task panel, SortableJS + keyboard menu.
- **Database:** `005_tasks.sql` (`tasks`, `task_assignees`, `labels`, `task_labels`, `subtasks`, `task_watchers`).
- **Acceptance:** Journeys 9 to 12 pass. 409 conflict handled cleanly.

---

### Phase 7: Task Comments and Collaboration
- **Objectives:** Discussions with mentions.
- **Features:** Threaded comments (1 level), edit, delete, `@mentions`, auto-watch.
- **Database:** `006_comments.sql` (`comments`).
- **Acceptance:** Journeys 13, 14 pass. Mention validation and XSS prevention verified.

---

### Phase 8: Real-Time WebSocket Infrastructure
- **Objectives:** Live collaboration via Socket.IO.
- **Features:** Authenticated sockets, rooms (`workspace`, `project`, `user`), bus-to-socket bridge, presence, forced disconnects, client deduplication and version guard.
- **Dependencies:** `socket.io` (prod), `socket.io-client` (dev).
- **Acceptance:** Real-time updates observed live across clients. Private project leak prevention confirmed (`WSK-6`).

---

### Phase 9: Notification System
- **Objectives:** Persistent, real-time, preference-aware notifications.
- **Features:** 9 trigger types, inbox UI, unread badge, preferences, background reminder and overdue jobs.
- **Database:** `007_notifications.sql` (`notifications`).
- **Acceptance:** Journey 15 passes. Reminders deduped idempotently.

---

### Phase 10: Dashboard and Analytics
- **Objectives:** Workspace overview and metrics.
- **Features:** Totals, completion stats, overdue counts, my tasks list, upcoming deadlines, project progress bars.
- **Acceptance:** Hand-counted seeded dataset matches dashboard aggregations; private projects excluded.

---

### Phase 11a: List View, Filters, and Search (MVP)
- **Objectives:** Second primary view and board filtering.
- **Features:** Filterable, sortable, paginated task table; URL-persisted filter state.
- **Acceptance:** List and board display identical synchronized data.

---

### Phase 11b: Extras (Post-MVP, Optional)
- **Objectives:** FTS5 global search, file attachments & avatars, task dependencies, bulk actions, CSV/JSON export, calendar view.
- **Database:** `008_extras.sql`.

---

### Phase 12: Security Hardening and Comprehensive Testing
- **Objectives:** Close all security gaps across the entire stack.
- **Activities:** Complete `SEC-*` suite verification, IDOR sweep across all endpoints, CSP verification against real DOM, dependency audit.

---

### Phase 13: Responsive Design and UX Refinement
- **Objectives:** Full design polish per `DESIGN.md`.
- **Activities:** Responsive verification (375px to 1440px), landing page, keyboard shortcut handler, accessibility pass.

---

### Phase 14: Deployment and Production Readiness
- **Objectives:** Production deployment configuration, automated backups, health checks, documentation.
