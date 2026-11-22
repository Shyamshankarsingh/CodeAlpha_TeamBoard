# Instructions for Coding Agents

Instructions for coding agents working on TeamBoard. Read this file, then [MEMORY.md](file:///e:/projectanagement/MEMORY.md), before touching anything.

**Current state:** Planning only. No application code exists. Do not start implementation until the user has approved the plan and the phase.

---

## 1. Source of Truth

| Topic | File |
| :--- | :--- |
| Scope and requirement IDs | [docs/PRD.md](file:///e:/projectanagement/docs/PRD.md) |
| Structure, layers, dependencies | [docs/ARCHITECTURE.md](file:///e:/projectanagement/docs/ARCHITECTURE.md) |
| Tables and constraints | [docs/DATABASE.md](file:///e:/projectanagement/docs/DATABASE.md) |
| Endpoints | [docs/API.md](file:///e:/projectanagement/docs/API.md) |
| Socket events | [docs/WEBSOCKET.md](file:///e:/projectanagement/docs/WEBSOCKET.md) |
| Permissions and security rules | [docs/SECURITY.md](file:///e:/projectanagement/docs/SECURITY.md) |
| UI rules | [docs/DESIGN.md](file:///e:/projectanagement/docs/DESIGN.md) |
| Tests | [docs/TESTING.md](file:///e:/projectanagement/docs/TESTING.md) |
| Phase scope | [docs/IMPLEMENTATION_PLAN.md](file:///e:/projectanagement/docs/IMPLEMENTATION_PLAN.md) |
| Why decisions were made | [DECISIONS.md](file:///e:/projectanagement/DECISIONS.md) |

If code and docs disagree, stop and ask. Do not silently change either.

---

## 2. Workflow Rules

1. Work on one phase at a time, in order. Do not begin the next phase without the user's approval.
2. Before coding a phase, restate its scope from the plan and list files you will create and modify.
3. Do not add features, endpoints, tables or dependencies that are not in the plan. New dependencies need approval and an update to [DECISIONS.md](file:///e:/projectanagement/DECISIONS.md) (ADR-015).
4. Do not change the technology stack. No React, Vue, Angular, Next.js, Redis, ORM, bundler, TypeScript or microservices.
5. Never claim a test passed unless you ran it and saw the output. Report failures as failures.
6. Small commits, one concern each, message format `phase-N: summary`. Never commit `.env`, database files or uploads.
7. After finishing a phase, update [MEMORY.md](file:///e:/projectanagement/MEMORY.md) (what is done, what is next, any decision changes) and the relevant docs.
8. Never overwrite the user's existing files without reading them first.

---

## 3. Code Conventions

- **Module format:** Node ES modules (`"type": "module"`), no TypeScript, no transpilation. `const` by default, strict equality, no unused variables.
- **Naming:** File names `kebab-case.js`; identifiers `camelCase`; database columns `snake_case`; API JSON fields `camelCase` (mapped in repos or services).
- **Layering is strict:** Routes parse input and shape output; services hold rules, authorization, transactions, events; repos hold SQL. A route never imports a repo. A service never builds SQL strings.
- **Functions:** Small and named for what they do. Prefer pure functions for logic testable without a database.
- **Errors:** Throw `AppError(code, status, message, details)` from `lib/errors.js`. Never send raw errors to clients.
- **Comments:** Explain *why*, not *what*. No commented-out code.

---

## 4. Database Rules

- Parameterized prepared statements only. No string concatenation of user data into SQL. Sort and filter identifiers come from allow-lists.
- Multi-row changes use `db.transaction(...)`. Side effects (socket emits, emails, domain events) go through `afterCommit(fn)`.
- Schema changes only by a new numbered migration file. Never edit an applied migration.
- Foreign keys are always on. Respect the cascade table in [docs/DATABASE.md](file:///e:/projectanagement/docs/DATABASE.md) section 4.
- Mutable shared rows use `version` and `expectedVersion`.
- Positions are produced only by `lib/position.js` on the server.

---

## 5. Security Rules (Non-Negotiable)

- Authorize on the server, in the service, against the loaded resource, through `lib/permissions.js`. Frontend checks are cosmetic.
- Never trust client-supplied user IDs, workspace IDs, project IDs, roles or room names for identity or access.
- A user with no access to a resource gets 404, not 403.
- Passwords: Argon2id only (or the approved fallback). Never log secrets, tokens, cookies or passwords.
- Session and reset tokens are stored hashed (SHA-256). Compare secrets in constant time.
- Every mutation passes: JSON content type, Origin check, CSRF token, validation schema, authorization.
- No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` or `eval` anywhere in `public/js`. Use the `h()` helper and `textContent`.
- No inline scripts or inline styles (CSP). Use classes and CSS variables.
- Socket rules: server decides rooms; check membership on every join; no data writes over sockets; emit only after commit; payloads contain only what the room may see.
- Uploads: allow-list, signature check, random stored name, outside `public/`, download-only.

---

## 6. Frontend Rules

- Vanilla ES modules, no build step. Components are functions returning DOM nodes, with `destroy()` for cleanup.
- State lives in the store. DOM is derived. Optimistic updates must reconcile with the server response and roll back on failure.
- Every interactive element is keyboard operable with a visible focus style; every icon-only control has an accessible name.
- Use design tokens from `tokens.css`; do not hard-code colors, spacing or radii. New color pairs need a contrast check (AA).
- Mobile first. Verify 375, 390, 768, 1024, 1280 and 1440 px. No horizontal page scroll at 375 px.
- Drag and drop always has a non-drag alternative.

---

## 7. Testing Rules

- Test runner: `node --test`. Each test file uses its own temp database and app instance. No real-time sleeps; use the injected clock.
- Each endpoint: happy path, validation, unauthenticated, each role, non-member (404), stale version (409) where relevant.
- Each socket event: room isolation test.
- Test IDs follow [docs/TESTING.md](file:///e:/projectanagement/docs/TESTING.md).

---

## 8. Planned Commands

```bash
npm install        # install dependencies
npm run dev        # start with node --watch
npm start          # start production mode
npm test           # run all tests (node --test)
```
