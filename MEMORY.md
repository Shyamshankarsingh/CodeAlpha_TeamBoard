# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 4 complete and verified. Ready for Phase 5 approval.
- **Code:**
  - Project management (`/api/projects` and `/api/workspaces/:wid/projects`): project CRUD, visibility boundaries (`workspace` vs `private`), optimistic locking concurrency control (`expectedVersion` returning 409 conflict), archive/unarchive lifecycle, atomic creation with lead member assignment.
  - Project membership management: add workspace members to projects as `lead` or `member`, update project roles, remove members.
  - In-process domain event bus (`server/lib/events.js`): decoupled pub/sub for domain events (`project.created`, `project.updated`, `project.archived`, `project.deleted`, etc.), emitted strictly after transaction commit.
  - Activity audit logging (`server/lib/activity.js` & `activity_logs` table): audit entries recorded for entity lifecycle mutations; cursor-paginated endpoints for project-level and workspace-level activity feeds.
  - Centralized permissions ([server/lib/permissions.js](file:///e:/projectanagement/server/lib/permissions.js)): updated with project role matrix, privacy boundary enforcement (workspace owners and admins retain visibility per ADR-021; unauthorized users receive 404 to avoid existence leakage).
  - Database migration: `003_projects.sql` creating `projects`, `project_members`, and `activity_logs`.
  - Frontend UI: Accessible modal dialog component (`public/js/components/dialog.js`), project listing page with search/filters/creation dialog (`public/js/pages/projects.js`), project details view with overview, members tab, and activity audit feed (`public/js/pages/project-detail.js`), updated sidebar and client router. Zero raw HTML injection (`innerHTML`), pure DOM `h()` builder.
- **Tests:** 74 tests passing across 15 suites (`npm test`).
- **Repository:** Phase 4 ready to commit (`phase-4: project management`).
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
| **5** | Board and column management (004) | Ready to begin |
| **6** | Task management and drag & drop (005) | Not started |
| **7** | Comments and collaboration (006) | Not started |
| **8** | Real-time WebSocket infrastructure (Socket.IO) | Not started |
| **9** | Notification system (007) | Not started |
| **10** | Dashboard and analytics | Not started |
| **11a** | List view, filters, search (MVP) | Not started |
| **11b** | Extras (FTS5 search, attachments, bulk, export) | Not started |
| **12** | Security hardening and comprehensive testing | Not started |
| **13** | Responsive design and UX refinement | Not started |
| **14** | Deployment and production readiness | Not started |
