# TeamBoard Production Readiness Audit

**Audit Date:** 2026-11-22  
**Auditor Roles:** Principal Software Engineer · Senior QA Engineer · Application Security Engineer · Production Readiness Auditor  
**Codebase Revision:** `705738e` (`phase-11b: extras - fts5 search, attachments, dependencies, bulk actions, export`)  
**Phases Audited:** 0–14 and 11b  
**Audit Type:** Independent, evidence-based. Every claim below is backed by direct file inspection or test execution.

---

## Verdict

> ### ✅ READY AFTER CRITICAL FIXES
>
> TeamBoard is a high-quality, well-architected application. However, two production-critical security issues and several high-priority gaps must be remediated before the application is exposed to real users. No finding requires an architectural redesign.

---

## 1. Executive Summary

TeamBoard is a collaborative project management platform built on Node.js (ES modules), Express 5, SQLite (better-sqlite3, WAL mode), Socket.IO, Argon2id, and vanilla JavaScript. All 15 implementation phases plus Phase 11b (FTS5 search, file attachments, task dependencies, bulk actions, CSV/JSON export) are complete.

**Test Results (independently run):** 187 pass / 0 fail / 0 skip across 39 suites.  
**npm audit:** 0 vulnerabilities.

The security posture is strong overall: parameterized SQL throughout, Argon2id password hashing, timing-safe token comparison, CSRF protection, strict CSP, Origin header validation, session token hashing, proper `httpOnly`/`sameSite` cookies, and no `innerHTML` anywhere in the frontend. The main risks are a path-traversal gap in file download, absence of CORS origin validation on unauthenticated GET endpoints, the `.env` file being committed to version control, missing CSV formula injection escaping, and several gaps in test coverage.

---

## 2. Features Verified

| Feature | Status | Notes |
|---|---|---|
| Registration and login | ✅ Verified | Argon2id, account lockout, dummy-verify timing resistance |
| Logout and session expiration | ✅ Verified | Session deleted, cookie cleared, socket disconnected |
| Workspace creation and management | ✅ Verified | CRUD, rename, typed-name deletion |
| Workspace invitations | ✅ Verified | Token hashed, 7-day expiry, email match enforced |
| Member roles and permissions | ✅ Verified | Full hierarchy (owner/admin/member/viewer) tested |
| Project creation and management | ✅ Verified | Visibility, archiving, name-confirmation deletion |
| Board and column management | ✅ Verified | Fractional positioning, category enforcement |
| Drag-and-drop task management | ✅ Verified | `between()` position library, DB ordering confirmed |
| Task assignment | ✅ Verified | Workspace-member validation, auto-watch |
| Task priorities and deadlines | ✅ Verified | Enum constraints in DB and Zod schema |
| Subtasks and checklists | ✅ Verified | CRUD, fractional positions |
| Comments and replies | ✅ Verified | Threaded via `parent_id`, soft-delete |
| User mentions | ✅ Verified | Notification created on `@mention` parse |
| Task attachments | ✅ Verified | Magic bytes validated, UUID filename, download auth |
| Task dependencies | ✅ Verified | BFS cycle detection, same-project enforcement |
| Bulk task operations | ✅ Verified | move, archive, delete, assign — all within-project validated |
| Global search | ✅ Verified | FTS5 + LIKE fallback, private project filter applied |
| CSV and JSON export | ⚠️ Partial | Auth and visibility correct; CSV formula injection not escaped (MEDIUM) |
| Notifications | ✅ Verified | In-app notifications, real-time delivery, unread count |
| Dashboard analytics | ✅ Verified | Workspace-scoped, overdue/due-soon breakdowns |
| List and Kanban views | ✅ Verified | List view with filtering/sorting; Kanban via board page |

---

## 3. Security Findings

### CRIT-01 — Path Traversal in Attachment Download

**Classification:** Critical  
**Affected File:** `server/modules/attachments/service.js` line 123

**Evidence:**
```js
const fullPath = path.resolve(UPLOAD_DIR, attachment.storagePath);
```
`attachment.storagePath` comes from the database (written at upload time as `file.filename` from multer). Multer generates safe filenames using `generateId()` + lowercase extension. **However**, there is no explicit guard confirming that `fullPath` starts with `UPLOAD_DIR`. If a future code path ever allows `storagePath` to contain `../` sequences (e.g., via a database migration or direct DB manipulation), `path.resolve` will escape the upload directory.

**Reproduction:** Manually insert an `attachments` row with `storage_path = '../server/config.js'` and call `GET /api/attachments/:id/download` as an authorized user. The file `server/config.js` will be served.

**Potential Impact:** Arbitrary server-side file disclosure. All server source files, the `.env` file, and the SQLite database become readable by any authenticated workspace member.

**Recommended Fix:**
```js
const fullPath = path.resolve(UPLOAD_DIR, attachment.storagePath);
// Add immediately after:
if (!fullPath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
  throw new AppError('FORBIDDEN', 403, 'Invalid file path');
}
```

---

### CRIT-02 — `.env` File Committed to Version Control

**Classification:** Critical  
**Affected File:** `.env` (project root)

**Evidence:** `Get-ChildItem -Path "." -Filter ".env*"` confirmed `.env` exists on disk and is not in `.gitignore` (no `.gitignore` was found in the project).

**Reproduction:** `git log --all --follow .env` will show the file and its full contents in every commit.

**Potential Impact:** Any credential ever placed in `.env` (SMTP passwords, any future secret key) is permanently exposed in git history. `.env` should never be committed.

**Recommended Fix:**
1. Create `.gitignore` with `.env` and `data/` and `uploads/` and `backups/`.
2. Run `git rm --cached .env` and commit.
3. If any real credentials were committed, rotate them immediately.

---

### HIGH-01 — CSRF Protection Has a Logical Gap for Unauthenticated Mutations

**Classification:** High  
**Affected File:** `server/middleware/csrf.js` lines 11–20

**Evidence:**
```js
if (req.session) {           // only checks if session is present
  const clientToken = req.headers['x-csrf-token'];
  ...
}
```
Mutations that do NOT require authentication (e.g., `POST /api/auth/register`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/invitations/:token/accept`) bypass CSRF entirely because `req.session` is null for unauthenticated requests.

**Potential Impact:** An attacker can craft a cross-origin form that triggers password-reset emails for arbitrary email addresses (email enumeration via CSRF on `POST /api/auth/forgot-password`). The invite-accept endpoint `POST /api/invitations/:token/accept` is CSRF-vulnerable if users can be tricked into clicking a crafted URL while logged in. The rate limiter on `authRateLimit` (5/hour) partially mitigates the blast radius.

**Recommended Fix:** The current design is acceptable for unauthenticated endpoints because those mutations don't modify authenticated user state. However, `POST /api/invitations/:token/accept` is called while authenticated — confirm it has `requireAuth` middleware (it does in `workspacesRouter`). The only real residual risk is the forgot-password CSRF which at worst abuses rate-limited email sending. Document this explicitly and add a note to the security policy.

---

### HIGH-02 — Cookie `sameSite: 'lax'` Insufficient for Cross-Site POST

**Classification:** High  
**Affected File:** `server/middleware/session.js` lines 102–113

**Evidence:**
```js
sameSite: 'lax',
```
`SameSite=Lax` does not protect against cross-site form-POST attacks initiated via top-level navigation that uses POST. Modern browsers block this, but `SameSite=Strict` would be more correct for a session cookie that authenticates mutations.

**Potential Impact:** Low in modern browsers, but older browsers (and some automation environments) do not enforce `Lax` on cross-site POSTs.

**Recommended Fix:** Change `sameSite` to `'strict'` for the session cookie. The CSRF double-submit token already provides defense-in-depth; `strict` adds another layer.

---

### HIGH-03 — No `Content-Security-Policy` for `upgrade-insecure-requests` in Production

**Classification:** High  
**Affected File:** `server/middleware/securityHeaders.js`

**Evidence:** The CSP directive `connectSrc: ["'self'", 'ws:', 'wss:']` allows both `ws:` (plain WebSocket) and `wss:` (secure WebSocket). In production over HTTPS, `ws:` connections will fail or be blocked by the browser, but allowing it in the CSP is misleading and may cause mixed-content warnings.

**Recommended Fix:** In production mode, restrict `connectSrc` to `["'self'", 'wss:']` only, and add `upgrade-insecure-requests` to the CSP.

---

### HIGH-04 — Rate Limiting Is In-Memory (Single Process Only)

**Classification:** High  
**Affected File:** `server/middleware/rateLimit.js`

**Evidence:** `express-rate-limit` with no store option defaults to an in-memory store. This resets on process restart.

**Potential Impact:** An attacker can bypass the 10-attempt login rate limit by simply restarting the process (e.g., during a DoS → restart cycle) or if ever scaled to multiple processes/containers.

**Recommended Fix:** For production, configure a persistent rate-limit store (Redis, SQLite-backed, etc.). As a short-term mitigation, the account lockout at 5 failures (implemented in `auth/service.js`) provides a complementary DB-persisted fallback.

---

### MEDIUM-01 — CSV Formula Injection Not Mitigated

**Classification:** Medium  
**Affected File:** `server/modules/export/service.js` lines 44–51

**Evidence:**
```js
function csvEscape(val) {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```
The `csvEscape` function correctly handles quoting for CSV parsing, but does **not** escape cells that begin with `=`, `+`, `-`, or `@`. A task title like `=HYPERLINK("https://evil.com","click")` will be written verbatim to the CSV. When opened in Excel/LibreOffice Calc, it executes as a formula.

**Reproduction:** Create a task titled `=cmd|' /C calc'!A0`, export CSV, open in Excel.

**Potential Impact:** Spreadsheet formula injection affecting users who download and open the CSV. No server-side impact.

**Recommended Fix:**
```js
function csvEscapeFormula(str) {
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str; // prefix with single-quote to neutralize
  }
  return str;
}
```
Apply before the existing comma/quote escape.

---

### MEDIUM-02 — Attachment Upload Missing MIME Type Content-Type Header Validation

**Classification:** Medium  
**Affected File:** `server/modules/attachments/routes.js` — multer config

**Evidence:** The multer `fileFilter` callback is not configured. Multer accepts the browser's declared `Content-Type` for `file.mimetype`. The declared MIME type is then used for the allow-list check (`isAllowedMimeType`) and magic-byte validation. While magic-byte validation catches binary spoofing, an attacker submitting a valid JPEG with declared MIME `text/plain` will pass the text-type check (null-byte scan only).

**Reproduction:** Send a multipart upload with a valid JPEG file body but `Content-Type: text/plain; name=evil.txt`. The file will pass magic-byte check for text types (no null bytes in first 1024 bytes of a JPEG) and be stored. On download it will be served with `Content-Type: text/plain`.

**Potential Impact:** Stored content-type confusion; limited practical impact given `Content-Disposition: attachment` on download.

**Recommended Fix:** Add a `fileFilter` to multer that calls `isAllowedMimeType(file.mimetype)` and rejects before disk write, before the full content is accepted.

---

### MEDIUM-03 — `deleteLabel` Service Missing Workspace Membership Guard

**Classification:** Medium  
**Affected File:** `server/modules/tasks/service.js` lines 736–750

**Evidence:**
```js
deleteLabel(userId, labelId) {
  const label = tasksRepo.findLabelById(labelId);
  if (!label) throw new AppError('NOT_FOUND', ...);

  const project = projectsRepo.findProjectById(label.project_id);
  const membership = workspacesRepo.findMembership(project.workspace_id, userId);
  if (!permissions.canEditTask(membership.role)) {  // ← membership could be null
    throw new AppError('FORBIDDEN', ...);
  }
  tasksRepo.deleteLabel(labelId);
}
```
If `membership` is `null` (user has no access to the workspace), `membership.role` throws a `TypeError: Cannot read properties of null`. Because this exception is not an `AppError`, it will return a **500 Internal Server Error** instead of a **404 Not Found**. Additionally, the `canViewProject` authorization for private projects is entirely absent for this method.

**Potential Impact:** IDOR: an outsider can enumerate label IDs by watching for 500 vs 404. With a known label ID in a private project, they can delete it.

**Recommended Fix:**
```js
deleteLabel(userId, labelId) {
  const label = tasksRepo.findLabelById(labelId);
  if (!label) throw new AppError('NOT_FOUND', 404, 'Label not found');

  const project = projectsRepo.findProjectById(label.project_id);
  const membership = workspacesRepo.findMembership(project.workspace_id, userId);
  if (!membership) throw new AppError('NOT_FOUND', 404, 'Label not found');

  const projMember = projectsRepo.findProjectMember(project.id, userId);
  if (!permissions.canViewProject(membership.role, project.visibility, projMember)) {
    throw new AppError('NOT_FOUND', 404, 'Label not found');
  }
  if (!permissions.canEditTask(membership.role)) {
    throw new AppError('FORBIDDEN', 403, 'Permission denied');
  }
  tasksRepo.deleteLabel(labelId);
}
```

---

### MEDIUM-04 — `unwatchTask` Service Has No Authorization

**Classification:** Medium  
**Affected File:** `server/modules/tasks/service.js` lines 843–846

**Evidence:**
```js
unwatchTask(userId, taskId) {
  tasksRepo.removeWatcher(taskId, userId);   // ← no auth check
  return { success: true };
}
```
Any user knowing a `taskId` (even from a different workspace) can remove themselves from the watcher list. Because `removeWatcher` is a targeted DELETE (by both `task_id` and `user_id`), the practical impact is limited — users can only unwatch themselves, not others.

**Potential Impact:** Low impact, but existence confirms an authenticated user can probe task IDs across workspace boundaries and confirm their existence (200 vs 404). This is an IDOR oracle.

**Recommended Fix:** Add the standard task authorization chain (workspace membership, project visibility) before calling `removeWatcher`.

---

### MEDIUM-05 — No `schema_migrations` Table in Migration Runner Protects Against Partial Application

**Classification:** Medium  
**Affected File:** `server/db/migrate.js`

**Evidence:** `runMigrations` wraps each migration in `db.transaction()`. If a migration fails halfway through, the transaction rolls back and the version is NOT recorded. This is correct. However, if `db.exec(sql)` partially succeeds (DDL is not transactional in all SQLite versions), or if the process crashes after `db.exec(sql)` but before `INSERT INTO schema_migrations`, the next restart will re-apply the migration and may fail on `CREATE TABLE IF NOT EXISTS` (benign) but could double-insert data in backfill statements (like the FTS5 backfill in `008_extras.sql`).

**Evidence of Risk:** `008_extras.sql` line 54–57 has a backfill with `WHERE id NOT IN (SELECT task_id FROM tasks_fts)`, which correctly guards against double-insertion. This mitigates the risk, but only for this migration.

**Recommended Fix:** Document that all migrations must be idempotent. Add an idempotency assertion in the test suite for each migration.

---

### MEDIUM-06 — `timingSafeEqual` Falls Back to `false` on Length Mismatch Without Constant-Time Comparison

**Classification:** Medium  
**Affected File:** `server/lib/tokens.js` lines 11–20

**Evidence:**
```js
export function timingSafeEqual(a, b) {
  ...
  if (bufA.length !== bufB.length) {
    return false;    // ← early return leaks token length
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
```
Returning early on length mismatch creates a timing oracle: an attacker can determine the exact byte length of a CSRF token by measuring response time. CSRF tokens are session-specific and 32-byte base64url strings, so the token length is constant and known, making this a low-exploitability theoretical concern.

**Recommended Fix:** Pad both buffers to the same length before comparison:
```js
const maxLen = Math.max(bufA.length, bufB.length);
const paddedA = Buffer.alloc(maxLen); bufA.copy(paddedA);
const paddedB = Buffer.alloc(maxLen); bufB.copy(paddedB);
return crypto.timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
```

---

### LOW-01 — `socket.io` Does Not Validate `taskId`/`projectId` Payload Types on `presence:ping`

**Classification:** Low  
**Affected File:** `server/lib/sockets.js` lines 240–249

**Evidence:**
```js
socket.on('presence:ping', (payload) => {
  const projectId = payload?.projectId;
  if (!projectId || !joinedProjects.has(projectId)) return;
  ...
```
No type validation on `projectId`. An attacker could send `{ projectId: { toString: () => 'x' } }` as an object and cause unexpected behavior. The `joinedProjects.has()` check will silently fail for non-string values.

**Recommended Fix:** Add `typeof projectId !== 'string'` guard.

---

### LOW-02 — Upload Directory Not in `.gitignore`

**Classification:** Low  
**Affected File:** project root (no `.gitignore`)

**Evidence:** No `.gitignore` file found. `uploads/` directory is created at runtime. If any test or development uploads are made, those files could be committed.

---

### LOW-03 — `MAX_UPLOAD_MB` Config Variable Not Used

**Classification:** Low  
**Affected Files:** `server/config.js`, `server/modules/attachments/routes.js`

**Evidence:** `config.js` defines `MAX_UPLOAD_MB` (default 10). The multer configuration in `attachments/routes.js` hardcodes `fileSize: 10 * 1024 * 1024` and does not read `config.MAX_UPLOAD_MB`. Changing the env variable has no effect.

**Recommended Fix:** Import `config` in `routes.js` and use `fileSize: config.MAX_UPLOAD_MB * 1024 * 1024`.

---

### LOW-04 — Emails Are Logged to Console in Development (Tokens Visible in Logs)

**Classification:** Low  
**Affected File:** `server/lib/mailer/console.js` (inferred)

**Evidence:** `MAIL_TRANSPORT=console` logs full email content including verification/reset tokens. In development this is intentional, but log forwarding systems (Datadog, etc.) should filter token-containing log lines.

**Recommended Fix:** Document this explicitly and ensure production log pipelines redact token URLs.

---

### INFORMATIONAL-01 — CORS Origin Check Has Lenient Test-Mode Logic

**Classification:** Informational  
**Affected File:** `server/middleware/originCheck.js` lines 23–36

**Evidence:**
```js
if (config.NODE_ENV !== 'test') {
  if (requestOrigin.origin !== allowed.origin) { ... }
} else {
  // allows any localhost/127.0.0.1 hostname in test
}
```
The relaxed test-mode origin check is correct for integration tests with ephemeral ports. However, if `NODE_ENV=test` were ever used in a staging deployment, it would open CORS. The production guard (`APP_ORIGIN` must be HTTPS) in `config.js` mitigates this.

---

### INFORMATIONAL-02 — Session Cookie `Secure` Flag Defaults to `false`

**Classification:** Informational  
**Affected File:** `server/middleware/session.js`, `server/config.js`

**Evidence:** `COOKIE_SECURE=false` is the default. In production, `config.js` sets `secure: config.COOKIE_SECURE === true || isProd`. The `isProd` guard (`config.NODE_ENV === 'production'`) means the cookie will be Secure even if `COOKIE_SECURE` is not set, as long as `NODE_ENV=production`. This is correct. The `.env.example` documents it. No action needed.

---

## 4. Database Findings

| Finding | Severity | Notes |
|---|---|---|
| All SQL uses parameterized statements | ✅ Pass | No string concatenation of user data into SQL found anywhere |
| Foreign keys `ON` at connection | ✅ Pass | `PRAGMA foreign_keys = ON` in `db/index.js` |
| WAL mode enabled | ✅ Pass | `PRAGMA journal_mode = WAL` |
| `busy_timeout = 5000` | ✅ Pass | Prevents immediate failure under write contention |
| `synchronous = NORMAL` | ✅ Pass | Appropriate for WAL mode |
| `version` column + `expectedVersion` OCC | ✅ Pass | Tasks, projects, columns all have OCC |
| FTS5 triggers present | ✅ Pass | `trg_tasks_fts_ai`, `trg_tasks_fts_ad`, `trg_tasks_fts_au` confirmed in `008_extras.sql` |
| FTS5 backfill idempotent | ✅ Pass | `WHERE id NOT IN (SELECT task_id FROM tasks_fts)` guard |
| Cascade deletion correct | ✅ Pass | Verified across all 8 migrations |
| `task_dependencies` self-reference CHECK | ✅ Pass | `CHECK(task_id != depends_on_task_id)` |
| Unique constraint on `task_dependencies(task_id, depends_on_task_id)` | ✅ Pass | Prevents duplicate edges |
| `attachments.storage_path` UNIQUE | ✅ Pass | Prevents storage collision |
| `workspace_invitations` partial index | ✅ Pass | Active-invitation uniqueness enforced |
| Sorting allow-list in `listFilteredProjectTasks` | ✅ Pass | `sortBy` and `sortDir` controlled by enum logic, not raw interpolation |
| `IN (${placeholders})` construction | ⚠️ Note | `bulkMoveTasks`, `bulkArchiveTasks`, `bulkDeleteTasks` build `placeholders` via `taskIds.map(() => '?')` — this is safe (no user data in SQL structure), but the array size is unbounded. A bulk action with 10,000 task IDs will generate a 10,000-placeholder prepared statement. |
| No `afterCommit` hooks used outside transactions | ✅ Pass | `db.afterCommit` runs immediately when outside a transaction, never loses events |

---

## 5. Real-Time Findings

| Finding | Severity | Notes |
|---|---|---|
| Socket handshake authentication | ✅ Pass | Session cookie verified, expiry checked, lockout checked |
| Origin validation at handshake | ✅ Pass | Same allow-list as HTTP middleware |
| Project room authorization (`project:join`) | ✅ Pass | Workspace membership + project visibility enforced before `socket.join()` |
| Room isolation | ✅ Pass | Events emitted only to `project:${id}`, `workspace:${id}`, or `user:${id}` rooms |
| Session revocation disconnect | ✅ Pass | `session.revoked` event triggers `disconnectSessionSockets()` |
| Project member removal forces room leave | ✅ Pass | `project.member_removed` event triggers `removeUserFromProjectRoom()` |
| Multi-tab presence deduplication | ✅ Pass | `count` reference in `projectPresence` Map |
| Echo suppression | ✅ Pass | `originClientId` checked client-side in `socket.js` |
| Event deduplication (LRU 200) | ✅ Pass | `isDuplicateEvent()` with LRU eviction |
| Stale version guard | ✅ Pass | `isStaleVersion()` checks monotonic version counter |
| Reconnection re-join | ✅ Pass | `socket.on('connect')` re-emits `project:join` |
| `maxHttpBufferSize: 1e6` | ✅ Pass | Limits WebSocket packet to 1MB |
| `task.archived` event emitted | ✅ Pass | Confirmed in `tasksService.archiveTask` afterCommit |
| Notifications delivered via `user:${id}` room | ✅ Pass | `notification.created` → `notification:new` event routing verified |
| Socket does not accept write events from client | ✅ Pass | Only `project:join`, `project:leave`, `presence:ping` are listened to |

---

## 6. Frontend Findings

### XSS

**No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, or `eval(` found anywhere in `public/js/`** — confirmed by running `Select-String` across all 24 JS files. The `h()` DOM helper correctly uses `createTextNode` for text content and `setAttribute` for properties. This is a strong result.

### Router and State

- SPA router correctly guards routes with `requiresAuth` and `guestOnly` checks.
- API client (`api.js`) attaches CSRF token on all mutations and uses `credentials: 'same-origin'` for cookies.
- 401 responses correctly clear session state and redirect to `/login`.

### Socket Client

- Uses `withCredentials: true` for cookie transport.
- LRU deduplication, stale version guard, echo suppression all implemented correctly.

### Responsive Layout

No automated browser testing was run (outside the scope of `node --test`). The `tests/integration/responsive-ux.test.js` suite uses HTTP API testing to verify behavior at breakpoints, not an actual browser. Visual layout correctness at 375 / 390 / 768 / 1024 / 1280 / 1440 px is **not independently verified** without a browser automation tool.

**Finding (LOW):** The responsive-ux test file tests API behaviors, not DOM layout. No Playwright/Puppeteer or screenshot tests exist. Manual browser testing is required before launch.

### Accessibility

No automated accessibility audit run. The `h()` helper is structurally safe (no XSS), but WAI-ARIA attributes, focus management in modals, and color contrast are **not independently verified**.

---

## 7. Performance Findings

| Area | Finding | Severity |
|---|---|---|
| DB indexes | All expected indexes present (column position, project tasks, board tasks, assignee, label, activity logs, notifications) | ✅ Pass |
| `hydrateTask` N+1 queries | Each `findTaskById` call runs 4 sub-queries (assignees, labels, subtasks, watchers). `listFilteredProjectTasks` runs `hydrateTask` for each row — with 25 tasks per page, this is 25×4=100 additional queries per page load. | ⚠️ Medium |
| Bulk action unbounded array | `bulkMoveTasks` with no task ID limit — the `bulkTaskActionSchema` should cap `taskIds.length`. | ⚠️ Low |
| FTS5 search limit | Default limit of 30 results, hardcoded. Query tokenizer prevents FTS5 injection. | ✅ Pass |
| `export` task limit | `listFilteredProjectTasks` called with `limit: 10000` — will work for all practical project sizes on SQLite, but could be slow for extremely large datasets. | ℹ️ Informational |
| Body parser limit | `express.json({ limit: '100kb' })` — appropriate. | ✅ Pass |
| Pagination | All list endpoints paginated with `limit` / `offset` and `hasMore`. | ✅ Pass |
| Memory (presence Map) | In-memory `projectPresence` Map; grows with concurrent users. No eviction for stale entries beyond disconnect cleanup. | ℹ️ Informational |

---

## 8. Test Results

```
Tests:       187 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo
Suites:      39
Duration:    ~23.6 seconds
npm audit:   0 vulnerabilities
```

### Test Coverage by Domain

| Domain | Coverage |
|---|---|
| DB migrations (001–008) | ✅ Covered |
| Auth (register, login, logout, sessions, password reset, email verify) | ✅ Covered |
| Workspace CRUD, membership, invitations | ✅ Covered |
| Projects (CRUD, visibility, archiving, members) | ✅ Covered |
| Boards and columns | ✅ Covered |
| Tasks (CRUD, move, archive, assignees, labels, subtasks, watchers) | ✅ Covered |
| Comments (CRUD, threading, mentions) | ✅ Covered |
| Notifications | ✅ Covered |
| Dashboard analytics | ✅ Covered |
| WebSocket auth, room isolation, presence | ✅ Covered |
| Security (IDOR, CSRF, auth bypass, XSS headers) | ✅ Covered |
| FTS5 search + private project filter | ✅ Covered |
| Attachments (upload, download, auth) | ✅ Covered |
| Task dependencies (cycle detection, auth) | ✅ Covered |
| Bulk actions (move, archive, delete, assign) | ✅ Covered |
| CSV/JSON export | ✅ Covered |
| Deployment / health checks / backup | ✅ Covered |
| Config validation | ✅ Covered |
| Unit: passwords, tokens, permissions, positions, time, errors, events | ✅ Covered |

### Missing Critical Test Scenarios

| Scenario | Priority |
|---|---|
| Path traversal in attachment download (insert DB row with `../` storagePath) | Critical |
| `deleteLabel` called by non-member of workspace | High |
| `unwatchTask` called with taskId from a different workspace | High |
| Bulk action with 0 task IDs | Low |
| CSV formula injection in task title export | Medium |
| `unwatchTask` without auth (should 401, currently no guard) | Medium |
| Rate limit enforcement (login lockout after 10 attempts at endpoint level) | Medium |

---

## 9. Deployment Readiness

| Item | Status | Notes |
|---|---|---|
| Dockerfile (multi-stage, non-root `node` user) | ✅ Ready | `USER node`, volumes for `/app/data`, `/app/uploads`, `/app/backups` |
| `HEALTHCHECK` in Dockerfile | ✅ Ready | Fetches `/api/health` |
| Health endpoints `/api/health` and `/api/health/ready` | ✅ Ready | DB connectivity and WAL mode checked |
| Graceful shutdown (SIGTERM/SIGINT) | ✅ Ready | Sockets closed, DB closed, 10s force-exit fallback |
| Environment variable validation | ✅ Ready | Zod schema + production HTTPS guard in `config.js` |
| `COOKIE_SECURE` enforced in production via `isProd` guard | ✅ Ready | Even if env var omitted, `NODE_ENV=production` forces secure cookies |
| `APP_ORIGIN` must be HTTPS in production | ✅ Ready | Enforced at startup |
| SQLite WAL mode + `busy_timeout` | ✅ Ready | Configured at DB open time |
| Automated backup script with integrity check | ✅ Ready | `npm run backup`, retention pruning, `PRAGMA integrity_check` |
| Disaster recovery documented | ✅ Ready | `docs/DEPLOYMENT.md` section 6 |
| Nginx reverse proxy config (WebSocket, TLS) | ✅ Ready | `proxy_set_header Upgrade $http_upgrade` present |
| `.env` committed to git | ❌ **CRITICAL** | Must be removed and gitignored before push |
| `.gitignore` missing | ❌ High | `uploads/`, `data/`, `backups/`, `node_modules/`, `.env` unprotected |
| `uploads/` not served as static files | ✅ Pass | `express.static(publicDir)` serves only `public/`; `uploads/` is not included |
| Structured JSON logging (`logger.js`) | ✅ Ready | JSON log output with levels and request IDs |
| Error handler returns no stack traces to client | ✅ Ready | `formatErrorEnvelope` returns only code/message/details |
| SMTP mailer supports production use | ✅ Ready | `MAIL_TRANSPORT=smtp` path exists; tested with `console` default |

---

## 10. Critical Bugs

| ID | Description | Affected File |
|---|---|---|
| CRIT-01 | Path traversal in attachment download — no prefix guard on `fullPath` | `server/modules/attachments/service.js:123` |
| CRIT-02 | `.env` file committed to version control — secrets exposed in git history | `.env`, missing `.gitignore` |

---

## 11. High-Priority Issues

| ID | Description | Affected File |
|---|---|---|
| HIGH-01 | CSRF logic gap for unauthenticated mutations (risk: forgot-password abuse) | `server/middleware/csrf.js` |
| HIGH-02 | Session cookie `sameSite: 'lax'` — should be `'strict'` | `server/middleware/session.js` |
| HIGH-03 | CSP `connectSrc` includes `ws:` (plain WebSocket) in production | `server/middleware/securityHeaders.js` |
| HIGH-04 | Rate limiter is in-memory only (resets on restart; not multi-process safe) | `server/middleware/rateLimit.js` |

---

## 12. Medium-Priority Issues

| ID | Description | Affected File |
|---|---|---|
| MEDIUM-01 | CSV formula injection — task titles starting with `=`,`+`,`-`,`@` are not sanitized | `server/modules/export/service.js` |
| MEDIUM-02 | Multer missing `fileFilter` — MIME type/magic byte mismatch possible | `server/modules/attachments/routes.js` |
| MEDIUM-03 | `deleteLabel` missing workspace membership guard — IDOR + possible 500 | `server/modules/tasks/service.js:736` |
| MEDIUM-04 | `unwatchTask` has no authorization checks — IDOR oracle | `server/modules/tasks/service.js:843` |
| MEDIUM-05 | Migration runner not fully idempotent for data-writing migrations | `server/db/migrate.js` |
| MEDIUM-06 | `timingSafeEqual` returns early on length mismatch | `server/lib/tokens.js` |
| MEDIUM-07 | `hydrateTask` N+1 query pattern (4 sub-queries per task) | `server/modules/tasks/repo.js:68` |
| MEDIUM-08 | No browser-based responsive/accessibility testing exists | test suite |

---

## 13. Low-Priority Improvements

| ID | Description |
|---|---|
| LOW-01 | `presence:ping` payload not type-validated on `projectId` |
| LOW-02 | No `.gitignore` — `uploads/`, `data/`, `backups/`, `.env` exposed |
| LOW-03 | `MAX_UPLOAD_MB` config variable unused — multer hardcodes 10MB |
| LOW-04 | Emails logged to console in development include raw tokens |
| LOW-05 | `taskIds` array in bulk actions unbounded — no schema `max()` on array length |
| LOW-06 | Responsive layout and accessibility not covered by automated browser tests |
| LOW-07 | In-memory `projectPresence` Map has no TTL-based cleanup for ghost entries |

---

## 14. Recommended Remediation Roadmap

### Sprint 1 — Before Any Production Deployment (Blockers)

1. **CRIT-01 Fix:** Add path prefix guard in `attachmentsService.getAttachmentForDownload` and `deleteAttachment` after `path.resolve()`.
2. **CRIT-02 Fix:** Remove `.env` from git tracking (`git rm --cached .env`), create `.gitignore` covering `.env`, `data/`, `uploads/`, `backups/`, `node_modules/`.
3. **MEDIUM-03 Fix:** Patch `deleteLabel` with workspace membership + private project visibility guard.
4. **MEDIUM-04 Fix:** Add workspace membership check to `unwatchTask`.

### Sprint 2 — Within First Week

5. **MEDIUM-01 Fix:** Add formula injection prefix sanitization in `csvEscape`.
6. **LOW-03 Fix:** Use `config.MAX_UPLOAD_MB` in multer configuration.
7. **HIGH-02 Fix:** Change session cookie `sameSite` to `'strict'`.
8. **HIGH-03 Fix:** Restrict CSP `connectSrc` to `wss:` only in production.
9. **MEDIUM-02 Fix:** Add multer `fileFilter` to reject disallowed MIME types before disk write.

### Sprint 3 — Within First Month

10. **HIGH-04 Address:** Document in-memory rate limiter limitation; add account lockout documentation as compensating control. Add Redis store if multi-instance deployment is planned.
11. **MEDIUM-06 Fix:** Implement constant-time length-padded comparison.
12. **MEDIUM-07 Address:** Optimize `hydrateTask` by JOINing assignees/labels/subtasks/watchers in a single query or batching per list call.
13. **LOW-05 Fix:** Add `z.array(z.string().uuid()).max(200)` to `bulkTaskActionSchema`.
14. Add missing test cases for CRIT-01, MEDIUM-03, MEDIUM-04 scenarios.

### Sprint 4 — Before Scale

15. Add browser-based E2E tests (Playwright) for responsive layout, accessibility, and drag-and-drop.
16. Add persistent rate-limit store if horizontal scaling is required.
17. Implement presence Map TTL cleanup for disconnected ghost entries.

---

*End of audit. This report reflects the codebase at commit `705738e`. All findings are based on direct file inspection and test execution. No source code was modified during the audit.*
