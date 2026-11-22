# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 0 complete and verified. Ready for Phase 1 approval.
- **Code:** Basic express app with config validation, logging, security headers, error handling, SPA fallback, public HTML/CSS/JS shell.
- **Tests:** 12 tests passing across unit and integration suites (`npm test`).
- **Repository:** Git repository initialized at `e:\projectanagement`.
- **Environment:** Node v26.11.1, npm 11.20.0 on Windows.
- **Documentation:** Complete specification suite saved in root and `docs/`.

---

## Key Decisions

1. **ADR-001:** Greenfield start at `e:\projectanagement`, working name "TeamBoard", Node 26.
2. **ADR-002:** Drop separate Organization level (Workspace is tenant).
3. **ADR-006:** SortableJS drag-and-drop + keyboard menu.
4. **ADR-011:** Argon2id with `crypto.scrypt` fallback.
5. **ADR-012:** Console transport in dev, SMTP nodemailer later; switchable verification.
6. **ADR-013:** Zod validation library.
7. **ADR-014:** `node:test` + Playwright optional.
8. **ADR-015:** Approved dependency list.
9. **ADR-021:** Workspace Owners and Admins can see private projects.
10. **ADR-025:** Single unified Inbox.

---

## Phase Checklist

| Phase | Description | Status |
| :--- | :--- | :--- |
| **0** | Foundation, config, health, security headers | Completed |
| **1** | Database architecture, migrations (001), spikes | Ready to begin |
| **2** | Authentication and session management | Not started |
| **3** | Workspace and membership management (002) | Not started |
| **4** | Project management and domain event bus (003) | Not started |
| **5** | Board and column management (004) | Not started |
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
