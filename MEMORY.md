# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 11a complete and verified. Ready for Phase 12 approval (or Phase 11b if requested).
- **Code:**
  - List View, Filters, and Search (`/api/projects/:pid/tasks`):
    - `GET /api/projects/:pid/tasks`: List view tasks endpoint supporting multi-criteria filtering (`search`, `columnId`, `category`, `priority`, `assigneeId`, `labelId`, `dueDate`), parameterized queries, strict allowlisted sorting (`position`, `title`, `priority`, `due_date`, `created_at`), and offset/limit pagination with metadata (`total`, `limit`, `offset`, `hasMore`).
    - Privacy & Authorization: Service layer strictly verifies workspace membership and project visibility (`canViewProject`), returning 404 for non-members to prevent existence leaks.
  - Frontend UI:
    - View Switcher (`.tb-view-switcher`): Seamless toggle between Kanban Board (`☷ Board`) and List View (`☰ List`).
    - Task Filter Bar (`public/js/components/task-filter-bar.js`): Modular filter bar with real-time text search, column/status, priority, due date range, assignee, and label dropdowns with "Clear Filters" action. Filters apply to both Board view (filtering columns' cards) and List view (synchronous data display).
    - Task Table (`public/js/components/task-table.js`): Paginated, sortable table view featuring task status badges, priority badges, assignee avatars, label pills, due date highlight, sort indicators, and accessible keyboard navigation opening the task detail panel.
    - URL State Persistence: Two-way synchronization of active view, filter selections, sorting parameters, and pagination offsets via `window.history.replaceState`.
- **Tests:** 130 tests passing across 23 suites (`npm test`).
- **Repository:** Phase 11a ready to commit (`phase-11a: list view, filters, and search`).
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
| **10** | Dashboard and analytics | Completed |
| **11a** | List view, filters, search (MVP) | Completed |
| **11b** | Extras (FTS5 search, attachments, bulk, export) | Not started |
| **12** | Security hardening and comprehensive testing | Ready to begin |
| **13** | Responsive design and UX refinement | Not started |
| **14** | Deployment and production readiness | Not started |
