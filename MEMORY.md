# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 14 complete and verified. All core roadmap phases (0 through 14) are fully implemented and verified.
- **Code:**
  - Online SQLite Backups (`scripts/backup.js`):
    - Non-blocking online database backup using `better-sqlite3` `db.backup()`.
    - SQLite integrity check via `PRAGMA integrity_check` before marking backup valid.
    - Automated retention policy pruning keeping the 10 most recent backups.
    - CLI script executable standalone or via `npm run backup`.
  - Detailed Health & Readiness Endpoint (`server/app.js`):
    - Backward-compatible basic health check `GET /api/health` returning `{ status: 'ok' }`.
    - Detailed readiness probe `GET /api/health/ready` verifying live SQLite connectivity, WAL/memory journal mode, process uptime, and memory usage.
  - Containerization (`Dockerfile` & `.dockerignore`):
    - Multi-stage minimal Node 22 Alpine build with non-root `node` user.
    - Volume mounts for `/app/data`, `/app/uploads`, and `/app/backups`.
    - Built-in container health check probe.
  - Operational Documentation (`docs/DEPLOYMENT.md` & `README.md`):
    - Comprehensive production deployment runbook covering Docker, Docker Compose, systemd unit configuration, Nginx reverse proxy with SSL and WebSocket proxying, automated daily cron backups, and disaster recovery procedures.
    - Full project overview, technology matrix, quickstart, and directory breakdown in `README.md`.
- **Tests:** 166 tests passing across 33 suites (`npm test`).
- **Repository:** Phase 14 complete (`phase-14: deployment and production readiness`).
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
| **11b** | Extras (FTS5 search, attachments, bulk, export) | Deferred / Post-MVP |
| **12** | Security hardening and comprehensive testing | Completed |
| **13** | Responsive design and UX refinement | Completed |
| **14** | Deployment and production readiness | Completed |
