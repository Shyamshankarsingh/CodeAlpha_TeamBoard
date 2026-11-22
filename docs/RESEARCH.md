# Technical and Product Research

**Status:** Planning only.  
**Date:** 2026-11-22.  
**Related:** [PRD.md](file:///e:/projectanagement/docs/PRD.md), [DECISIONS.md](file:///e:/projectanagement/DECISIONS.md).

---

## 1. Product Comparisons & Takeaways

- **Trello:** Clean boards/columns/cards hierarchy. Simple mental model. Separate activity from comments.
- **Asana:** Single task record presented through multiple views (board, list, calendar).
- **Linear:** High-performance keyboard-first experience, optimistic UI, clean dark mode. Avoid over-engineering a sync engine; use REST writes + WebSocket push with versioning instead.
- **ClickUp:** Extensive feature set. Cautionary tale against scope creep—focus on rock-solid core MVP.
- **Plane / Focalboard / Vikunja:** Architectural validation of SQLite for single-node installations and layered modular services.

---

## 2. Technical Research by Area

### 2.1 Kanban Architecture & Ordering
- **Fractional Indexing:** String-based base-62 position keys (`between(a, b)`).
- **Avoid Integer Indexing:** Integer gaps require frequent renumbering of entire columns.
- **Collision Avoidance:** Server computes position keys inside transactions from neighbor IDs; clients cannot corrupt ordering.
- **Rebalance:** Automatic rebalancing when key length exceeds 48 characters.

### 2.2 Drag-and-Drop
- Native HTML5 Drag and Drop has poor touch support and no built-in keyboard navigation.
- **Recommendation:** SortableJS for pointer and touch drag-and-drop, paired with an accessible keyboard "Move to column / position" menu.

### 2.3 Real-time Collaboration (Socket.IO)
- **Writes via REST:** All mutations use REST with `expectedVersion`.
- **Sockets Push Only:** Sockets broadcast events post-commit. Sockets only listen for 3 client events: `project:join`, `project:leave`, and `presence:ping`.
- **Rooms:** `user:<id>`, `session:<sessionId>`, `workspace:<id>`, `project:<id>`. Server controls membership; clients never choose arbitrary rooms.

### 2.4 Authentication & Sessions
- Server-side sessions stored in SQLite with SHA-256 hashed session tokens.
- Opaque random cookie with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` (production).
- Argon2id password hashing (OWASP minimum: 19 MiB memory, t=2, p=1). Fallback to Node's built-in `crypto.scrypt` if native compilation is unavailable.
- Synchronizer CSRF token per session sent in `X-CSRF-Token` header.

### 2.5 SQLite in WAL Mode
- `better-sqlite3` synchronous driver in WAL mode (`journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`).
- Background job executes `wal_checkpoint(RESTART)` to prevent checkpoint starvation.
- All list queries indexed and paginated to avoid blocking the Node event loop.
