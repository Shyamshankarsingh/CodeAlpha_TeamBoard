# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 8 complete and verified. Ready for Phase 9 approval.
- **Code:**
  - Real-Time WebSocket Infrastructure (`server/lib/sockets.js`, `public/js/lib/socket.js`): Socket.IO server integrated with HTTP server, cookie session handshake authentication, origin verification.
  - Rooms & Security: `workspace:<id>`, `project:<id>`, `user:<id>`, `session:<id>`. Server-side room join authorization checking workspace membership, role, and private project visibility (`WSK-4`, `WSK-5`, `WSK-6`). Real-time departure on access revocation (`WSK-7`), immediate session termination on logout (`WSK-8`).
  - Domain Event Bridge: in-process `events` subscriber formatting event envelopes (`eventId`, `type`, `workspaceId`, `projectId`, `actorId`, `originClientId`, `ts`, `data`) and routing to target rooms post-commit (`WSK-9`).
  - Echo suppression & Concurrency: per-tab client UUID passed via `X-Client-Id` REST header and captured automatically through `AsyncLocalStorage` (`server/lib/context.js`), 200-item LRU event deduplication, entity version guarding (`WSK-10`, `WSK-11`, `WSK-12`, `WSK-13`).
  - Multi-tab presence deduplication (`WSK-15`): tab counters per user per project preventing duplicate join/leave broadcasts; 30s heartbeat ping loop; live collaborator avatar stack in Kanban board header.
- **Tests:** 108 tests passing across 20 suites (`npm test`).
- **Repository:** Phase 8 ready to commit (`phase-8: real-time websocket infrastructure`).
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
| **9** | Notification system (007) | Ready to begin |
| **10** | Dashboard and analytics | Not started |
| **11a** | List view, filters, search (MVP) | Not started |
| **11b** | Extras (FTS5 search, attachments, bulk, export) | Not started |
| **12** | Security hardening and comprehensive testing | Not started |
| **13** | Responsive design and UX refinement | Not started |
| **14** | Deployment and production readiness | Not started |
