# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 12 complete and verified. Ready for Phase 13 approval.
- **Code:**
  - Security Hardening & Controls (`tests/integration/security.test.js`):
    - `SEC-C1..C5`: Mutation safeguards verified. Missing or invalid `X-CSRF-Token` rejected (403), untrusted `Origin` rejected (403), non-JSON `Content-Type` on mutation bodies rejected with 415 (`UNSUPPORTED_MEDIA_TYPE`), and safe reads (GET) verified without CSRF/Origin requirements.
    - `SEC-I`: Complete IDOR sweep across all entities (workspaces, projects, boards, columns, tasks, comments, notifications). Unpermitted cross-tenant and cross-project accesses return 404 (preventing existence leakage).
    - `SEC-P`: Role permission matrix strictly enforced on server across all roles (Owner, Admin, Member, Viewer, Lead). Viewers strictly blocked from mutating tasks, comments, or workspaces (403). Private projects strictly hidden from workspace members without explicit project membership (404).
    - `SEC-S`: SQL injection attack payloads fuzzed across search and filters; verified parameterized statements and strict allowlist on sort parameters (400 validation error on injection).
    - `SEC-X`: Stored XSS vectors (scripts, event handlers, iframes) safely handled as literal strings without code execution.
    - `SEC-G`: Codebase static audit verifying zero unsafe DOM sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`) across `public/js/`.
    - Security headers verified: strict CSP (`default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.
    - Dependency audit: `npm audit` confirms 0 vulnerabilities.
- **Tests:** 157 tests passing across 31 suites (`npm test`).
- **Repository:** Phase 12 ready to commit (`phase-12: security hardening and comprehensive testing`).
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
| **12** | Security hardening and comprehensive testing | Completed |
| **13** | Responsive design and UX refinement | Ready to begin |
| **14** | Deployment and production readiness | Not started |
