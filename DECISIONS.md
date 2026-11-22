# Architectural Decision Records for TeamBoard

**Date:** 2026-11-22  
**Status values:**
- `Baseline` = taken directly from the brief, unchanged.
- `Proposed` = recommended baseline, safe to accept as is.
- `Needs approval` = deviates from or adds to the brief, or represents an architectural fork requiring user decision.

---

## Decisions Requiring Approval

| ADR | Question | Recommendation |
| :--- | :--- | :--- |
| **001** | Project location, name, and Node version | Working name "TeamBoard", workspace root as project root, Node 22+ LTS / Current. |
| **002** | Drop separate "Organization" level (Workspace is tenant) | Yes, add later only if needed. Simplifies joins and permissions for 2-30 user teams. |
| **006** | Drag-and-drop library | SortableJS + keyboard "Move to…" menu, confirmed by Phase 6 spike. |
| **011** | Argon2id through `argon2` npm package | Yes; fall back to Node `crypto.scrypt` if native build fails on target environment. |
| **012** | Email handling | Console transport in dev, SMTP nodemailer later; email verification switchable (off by default in dev). |
| **013** | Validation library | Add `zod` for consistent endpoint schema validation. |
| **014** | Testing stack | `node:test`, `fetch`, `socket.io-client`; Playwright optional for select E2E flows. |
| **015** | Dependency inventory | Approve explicit inventory in ARCHITECTURE.md (express, socket.io, better-sqlite3, argon2, zod, helmet, express-rate-limit, cookie, nodemailer, multer, sortablejs). |
| **021** | Private project visibility for admins | Owners and Admins can always see private projects in their workspace to avoid orphaned projects. |
| **025** | Single Inbox | Merge "Inbox" and "Notifications" into one unified Inbox for MVP. |

---

## Records

### ADR-001 Greenfield start and location
**Status:** Needs approval. Workspace is greenfield. We can use workspace root `e:\projectanagement` as the project root.

### ADR-002 Workspace is the tenant, no Organization table
**Status:** Needs approval. Workspace serves as the tenancy boundary. Simplifies data model and UI.

### ADR-003 Baseline stack
**Status:** Baseline. Vanilla JS ES modules, Express, REST, Socket.IO, SQLite with `better-sqlite3` in WAL mode, server-side sessions. No frontend framework, no ORM, no bundler, no TypeScript.

### ADR-004 Server-side sessions, hashed IDs, CSRF token
**Status:** Proposed. Opaque random session cookie, SHA-256 hash stored, per-session CSRF token, SameSite=Lax, Origin verification.

### ADR-005 Fractional string ordering computed by the server
**Status:** Proposed. Base-62 position keys, `between(a, b)`, rebalance when length exceeds 48 chars, ties broken by ID.

### ADR-006 Drag and drop: SortableJS plus keyboard menu
**Status:** Needs approval. SortableJS for pointer/touch drag-and-drop, plus an accessible keyboard "Move to..." menu. Phase 6 spike verification.

### ADR-007 Writes through REST, sockets push only
**Status:** Proposed. One authorized write path through REST. Sockets remain a broadcast/push channel post-commit.

### ADR-008 Optimistic locking with version
**Status:** Proposed. `expectedVersion` on mutations, HTTP 409 Conflict with current state on mismatch.

### ADR-009 Task status is column category
**Status:** Proposed. No separate status column; column category (`backlog`, `todo`, `in_progress`, `review`, `done`) determines status and progress.

### ADR-010 IDs and timestamps
**Status:** Proposed. UUID v4 text primary keys, ISO-8601 UTC text timestamps (`YYYY-MM-DDTHH:mm:ss.sssZ`), date-only as `YYYY-MM-DD`.

### ADR-011 Argon2id library
**Status:** Needs approval. `argon2` npm package with fallback to Node's built-in `crypto.scrypt`.

### ADR-012 Email handling
**Status:** Needs approval. Console transport for dev/testing, SMTP via nodemailer in production. `REQUIRE_EMAIL_VERIFICATION` flag (off in dev).

### ADR-013 Validation library
**Status:** Needs approval. `zod` for input schema validation across routes.

### ADR-014 Testing stack
**Status:** Needs approval. Built-in `node:test` runner, `fetch`, `socket.io-client`. Optional Playwright.

### ADR-015 Dependency policy and inventory
**Status:** Needs approval. Strict allowlist of dependencies; lockfile committed.

### ADR-016 Pagination strategy
**Status:** Proposed. Cursor pagination for feeds (notifications, activity, comments); offset pagination for list views and member lists.

### ADR-017 API shape
**Status:** Proposed. Unversioned `/api`, workspace-scoped resources, flat single-resource routes, uniform envelopes, 404 for unpermitted access.

### ADR-018 Notifications persisted, jobs in process
**Status:** Proposed. Written in same transaction as trigger; in-process timers for reminders and cleanup.

### ADR-019 Attachments on local disk (Deferred to Phase 11b)
**Status:** Proposed. Local storage outside web root with allowlist and magic-byte checks.

### ADR-020 Deletion semantics
**Status:** Proposed. Hard deletes with confirmation for workspaces, projects, boards, tasks. Archive available. Comments hard-deleted if no replies, soft-deleted if replied to.

### ADR-021 Private project visibility for admins
**Status:** Needs approval. Owners and Admins can view all projects in the workspace, including private ones.

### ADR-022 Task model simplifications
**Status:** Proposed. Subtasks double as checklists. Labels belong to project. Multiple assignees via join table.

### ADR-023 Search
**Status:** Proposed. LIKE filters in MVP; SQLite FTS5 for global search in Phase 11b.

### ADR-024 Repository layer for database portability
**Status:** Proposed. Raw SQL restricted to repository files (`repo.js`), services never build SQL.

### ADR-025 One Inbox
**Status:** Needs approval. Single unified inbox view for notifications and alerts.

### ADR-026 Docs-first, phase gating
**Status:** Baseline. Implementation proceeds phase by phase with approval gates.
