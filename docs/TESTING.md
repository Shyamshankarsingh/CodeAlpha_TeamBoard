# Testing Strategy & Test Catalogue

**Status:** Strategy only. No tests exist and none have been run.  
**Related:** [IMPLEMENTATION_PLAN.md](file:///e:/projectanagement/docs/IMPLEMENTATION_PLAN.md), [SECURITY.md](file:///e:/projectanagement/docs/SECURITY.md), [PRD.md](file:///e:/projectanagement/docs/PRD.md).

---

## 1. Tooling

- **Runner:** Built-in `node:test` with `node:assert/strict`.
- **HTTP Integration:** `fetch` against real server on ephemeral port with temporary SQLite database.
- **WebSocket:** `socket.io-client` against test server.
- **Time/Clock:** Injected clock helper for deterministic time manipulation without real-time sleeps.
- **Frontend Logic:** Headless unit tests for store reducers, fractional position math, permission matrix, and validators.

---

## 2. Test Catalogue IDs

### Authentication (`AUTH-*`)
- `AUTH-1`: Register user successfully.
- `AUTH-2`: Rejection of invalid emails, short/long passwords.
- `AUTH-3`: Duplicate email handling (enumeration mitigation).
- `AUTH-4`: Login sets secure cookie attributes.
- `AUTH-5`: Generic error for wrong credentials.
- `AUTH-6`: Account lockout after 5 consecutive failed attempts.
- `AUTH-7`: Logout invalidates session and disconnects sockets.
- `AUTH-8`: Expired idle and absolute sessions rejected.
- `AUTH-9`: Password change revokes other active sessions.
- `AUTH-10`..`14`: Password reset, token expiration, session revocation.

### Workspaces (`WS-*`)
- `WS-1`: Create workspace assigns creator as Owner.
- `WS-2`: Enforce workspace role matrix.
- `WS-3`: Last Owner invariant (cannot leave or demote).
- `WS-4`: Invitation issuance, validation, expiry, and single-use acceptance.
- `WS-5`: Member removal clears assignments, project access, and socket rooms.
- `WS-6`: Delete workspace requires exact typed name confirmation.
- `WS-7`: Ownership transfer.

### Projects (`PR-*`)
- `PR-1`: Atomic creation of project, lead membership, default board, and 5 columns.
- `PR-2`: Visibility boundaries (workspace vs. private).
- `PR-3`: Optimistic locking conflict (409) on stale update.
- `PR-4`: Archived projects reject task mutations.
- `PR-5`: Project deletion cascades to tasks and columns.
- `PR-6`: Progress percentage calculation.

### Boards & Columns (`BD-*`)
- `BD-1`: Add, rename, and delete column.
- `BD-2`: Non-empty column deletion blocked unless destination column is supplied.
- `BD-3`: Column reordering produces deterministic order across clients.
- `BD-4`: Column category change recomputes `completed_at` on contained tasks.
- `BD-5`: Last board deletion protection.
- `BD-6`: Board payload filters out archived tasks unless requested.

### Tasks (`TK-*`)
- `TK-1`: Task CRUD operations.
- `TK-2`: Task movement within and across columns.
- `TK-3`: Concurrent insertion into same gap converges deterministically.
- `TK-4`: `expectedVersion` mismatch returns 409 Conflict.
- `TK-5`: Moving to done column sets `completed_at`; moving out clears it.
- `TK-6`: Assignee permission validation.
- `TK-7`: Date validation (`start_date <= due_date`).
- `TK-8`: Cross-project label rejection.
- `TK-9`: Subtasks CRUD and reordering.
- `TK-10`: Task duplication.
- `TK-11`: Auto-watching logic.
- `TK-12`: Position key rebalancing when exceeding threshold.
- `TK-13`: `project_id` integrity invariant.
- `TK-14`: List view pagination, filtering, and sorting.

### WebSockets (`WSK-*`)
- `WSK-1`..`3`: Authentication and Origin handshake checks.
- `WSK-4`: Project room join authorization.
- `WSK-5`..`6`: Room isolation (private project isolation).
- `WSK-7`: Real-time room departure on access revocation.
- `WSK-8`: Immediate disconnect on logout.
- `WSK-9`: Events emitted only after database commit.
- `WSK-10`: Echo suppression via `originClientId`.
- `WSK-11`..`12`: Client deduplication and version guarding.
- `WSK-13`: Reconnect refetch state convergence.
- `WSK-14`: Malformed/oversized packet rejection and socket rate limits.
- `WSK-15`: Multi-tab presence deduplication.

### Security (`SEC-*`)
- `SEC-C1`..`C5`: CSRF token, Origin check, JSON content-type enforcement.
- `SEC-I`: IDOR test matrix across all endpoints.
- `SEC-P`: Generated permission matrix enforcement.
- `SEC-S`: SQL injection attack payloads in queries and filters.
- `SEC-X`: Stored XSS payload validation in text fields.
- `SEC-G`: Grep verification that no `innerHTML` or `document.write` exists in code.
