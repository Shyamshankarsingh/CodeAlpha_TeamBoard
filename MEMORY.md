# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 11b (Extras) complete and verified. 100% of all roadmap phases (0 through 14 + 11b) are fully implemented and verified.
- **Code:**
  - Database Migration 008 (`server/db/migrations/008_extras.sql`):
    - `attachments`: File metadata with strict foreign keys to tasks and users.
    - `task_dependencies`: Self-blocking prevention, duplicate prevention, and indexes.
    - `tasks_fts`: SQLite FTS5 virtual table synchronized via database triggers (`trg_tasks_fts_ai`, `trg_tasks_fts_ad`, `trg_tasks_fts_au`).
  - Attachments (`server/modules/attachments/`):
    - Magic bytes signature validation (`server/lib/file-signatures.js`) and mime-type allow-list.
    - Safe local storage outside webroot in `uploads/` with UUID filenames.
    - Download handler with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
    - Pure DOM attachment manager in `public/js/components/task-panel.js`.
  - SQLite FTS5 Global Search (`server/modules/search/`):
    - Full-text search with tokenization and prefix matching.
    - Workspace and private project permission isolation.
    - Global search modal palette in `public/js/components/search-modal.js` bound to `/` key.
  - Task Dependencies (`server/modules/dependencies/`):
    - Directed graph cycle detection (rejects cycles like A -> B -> A).
    - Blocked-by and blocks tracking in `public/js/components/task-panel.js`.
  - Bulk Task Actions (`server/modules/tasks/`):
    - `POST /api/projects/:projectId/tasks/bulk` for bulk move column, bulk assign, bulk archive, and bulk delete.
    - Interactive checkbox selection and floating bulk toolbar in `public/js/components/task-table.js`.
  - Project Data Export (`server/modules/export/`):
    - RFC 4180 CSV export with escaping and structured JSON export (`GET /api/projects/:projectId/export?format=csv|json`).
    - Export button in project detail header (`public/js/pages/project-detail.js`).
- **Tests:** 187 tests passing across 39 suites (`npm test`).
- **Repository:** Phase 11b complete (`phase-11b: extras - fts5 search, attachments, dependencies, bulk actions, export`).
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
| **11b** | Extras (FTS5 search, attachments, bulk, export) | Completed |
| **12** | Security hardening and comprehensive testing | Completed |
| **13** | Responsive design and UX refinement | Completed |
| **14** | Deployment and production readiness | Completed |
