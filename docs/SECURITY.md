# Security Architecture & Controls

**Status:** Design review.  
**Related:** [API.md](file:///e:/projectanagement/docs/API.md), [WEBSOCKET.md](file:///e:/projectanagement/docs/WEBSOCKET.md), [DATABASE.md](file:///e:/projectanagement/docs/DATABASE.md), [TESTING.md](file:///e:/projectanagement/docs/TESTING.md).

---

## 1. Threat Model & Key Mitigations

| Threat | Vulnerability / Attack | Architectural Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Credential stuffing, session theft | Argon2id hashing, rate limiting, lockout, HttpOnly/SameSite cookies, SHA-256 session token hashes. |
| **Tampering** | CSRF, state tampering | Synchronizer `X-CSRF-Token`, strict `Origin` check, `expectedVersion` concurrency check. |
| **Information Disclosure** | IDOR, data leakage | Centralized authorization in services, 404 for unpermitted access (no existence leak), sanitized WebSocket room broadcasts. |
| **Elevation of Privilege** | Bypassing UI role limits | Strict server-side permission matrix (`lib/permissions.js`), parameter re-authorization on every request. |
| **Cross-Site Scripting (XSS)** | Stored XSS in task titles/comments | Pure `textContent` / DOM building (`h()` helper), zero `innerHTML`, strict Content Security Policy (`script-src 'self'`). |
| **SQL Injection** | Dynamic SQL in filters/sorting | Prepared statements everywhere, allowlist validation for order by columns. |

---

## 2. Permission Matrix (Server-Enforced)

Roles: **O** (Owner), **A** (Admin), **M** (Member), **V** (Viewer). "Lead" is project-level role.

| Action | O | A | M | V |
| :--- | :---: | :---: | :---: | :---: |
| View workspace, accessible projects, boards, tasks | Y | Y | Y | Y |
| Update workspace settings | Y | Y | N | N |
| Delete workspace, transfer ownership | Y | N | N | N |
| Invite members (Member or Viewer) | Y | Y | N | N |
| Invite Admins, remove Admins | Y | N | N | N |
| Change role / remove Member or Viewer | Y | Y | N | N |
| Leave workspace (if not last Owner) | Y | Y | Y | Y |
| Create projects | Y | Y | Y | N |
| Edit/archive project settings | Y | Y | Lead | N |
| Delete project | Y | Y | N | N |
| Manage project members | Y | Y | Lead | N |
| Manage boards & columns | Y | Y | Lead | N |
| Create, edit, move, assign, archive tasks | Y | Y | Y | N |
| Delete tasks | Y | Y | Lead/Reporter | N |
| Create comments | Y | Y | Y | N |
| Edit own comment | Y | Y | Y | N |
| Delete any comment | Y | Y | Lead | N |
| Upload / delete attachment | Y | Y | Y / Lead | N |

### Visibility Rule (`canReadProject`):
- `workspace`: Any member of the workspace.
- `private`: Project members, plus workspace Owners and Admins (ADR-021).
