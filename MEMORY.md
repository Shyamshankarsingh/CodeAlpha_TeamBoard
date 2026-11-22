# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 2 complete and verified. Ready for Phase 3 approval.
- **Code:**
  - Full authentication module (`/api/auth`): register, login with Argon2id and session rotation, logout, me, email verification, forgot/reset password, change password, session listing & revocation.
  - Brute-force protection: 5-attempt account lockout (15 minutes), timing-safe dummy hash verification on unknown emails, rate limiters.
  - Security middleware: Session loader with idle/absolute timeouts, constant-time CSRF token verification, and mutation Origin checks.
  - User profile management (`/api/users`): profile update with IANA timezone validation, theme switching, and user search.
  - Frontend SPA: Vanilla ES module architecture with History router, reactive store, safe `h()` DOM builder (zero `innerHTML`), accessible auth pages (login, register, forgot/reset, verify, settings).
- **Tests:** 47 tests passing across 10 suites (`npm test`).
- **Repository:** Git repository clean at `phase-1`.
- **Environment:** Node v26.11.1, npm 11.20.0 on Windows.
- **Documentation:** Up to date.

---

## Phase Checklist

| Phase | Description | Status |
| :--- | :--- | :--- |
| **0** | Foundation, config, health, security headers | Completed |
| **1** | Database architecture, migrations (001), spikes | Completed |
| **2** | Authentication and session management | Completed |
| **3** | Workspace and membership management | Ready to begin |
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
