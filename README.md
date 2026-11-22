# TeamBoard (working name)

A collaborative project management platform: workspaces, projects, Kanban boards, tasks, comments with mentions, notifications and real-time updates. Inspired by tools such as Trello, Asana, Linear and ClickUp, without copying any of them.

**Status:** Planning only. This repository currently contains documentation. There is no application code, nothing has been installed, and no tests exist or have been run. The setup section below describes the planned workflow and does not work yet.

## Planned Features (MVP)

- **Accounts:** Register, log in, password reset, email verification (switchable), sessions review and revocation.
- **Workspaces:** Owner, Admin, Member, and Viewer roles, plus invitations.
- **Projects:** Visibility settings, dates, priority, members, progress, and activity feed.
- **Kanban Boards:** Custom columns with drag-and-drop (and accessible keyboard alternative).
- **Tasks:** Multiple assignees, labels, subtasks, due dates, and priorities.
- **Comments:** Threaded discussions with `@mentions`.
- **Real-Time Collaboration:** Real-time updates and presence powered by Socket.IO.
- **Notifications:** Persistent notification inbox, reminders, and overdue alerts.
- **Views & Dashboard:** Kanban board, list view, and workspace dashboard.
- **UX & Design:** Light/dark mode, fully responsive across 375px to 1440px.
- **Post-MVP Extras:** Attachments, global FTS5 search, dependencies, bulk actions, CSV/JSON export, calendar view (see [docs/PRD.md](file:///e:/projectanagement/docs/PRD.md)).

## Stack

- **Frontend:** HTML, CSS, vanilla JavaScript (ES modules). No front-end framework.
- **Backend:** Node.js, Express, REST API, Socket.IO.
- **Database:** SQLite via `better-sqlite3` in WAL mode.
- **Security:** Server-side sessions, Argon2id password hashing, CSRF tokens, strict CSP.

## Architecture in Brief

One Node process serves the static front end, REST API, and Socket.IO server on the same origin, backed by a single SQLite database file. All writes proceed through REST; sockets only push events after transactions commit. Routes call services, services handle business logic/authorization and invoke repositories, and repositories manage SQL.

## Documentation

| Document | Contents |
| :--- | :--- |
| [docs/PRD.md](file:///e:/projectanagement/docs/PRD.md) | Product scope, journeys, requirements |
| [docs/RESEARCH.md](file:///e:/projectanagement/docs/RESEARCH.md) | Technical and product research |
| [docs/ARCHITECTURE.md](file:///e:/projectanagement/docs/ARCHITECTURE.md) | Structure, layers, frontend, dependencies, scaling |
| [docs/DATABASE.md](file:///e:/projectanagement/docs/DATABASE.md) | Schema, constraints, ER diagram |
| [docs/API.md](file:///e:/projectanagement/docs/API.md) | REST endpoints and envelopes |
| [docs/WEBSOCKET.md](file:///e:/projectanagement/docs/WEBSOCKET.md) | Socket rooms, events, payloads |
| [docs/DESIGN.md](file:///e:/projectanagement/docs/DESIGN.md) | Design system, tokens, responsive plan |
| [docs/SECURITY.md](file:///e:/projectanagement/docs/SECURITY.md) | Threat model, controls, permission matrix |
| [docs/TESTING.md](file:///e:/projectanagement/docs/TESTING.md) | Test strategy and catalogue |
| [docs/IMPLEMENTATION_PLAN.md](file:///e:/projectanagement/docs/IMPLEMENTATION_PLAN.md) | Phase-by-phase roadmap |
| [DECISIONS.md](file:///e:/projectanagement/DECISIONS.md) | Decision records and open questions |
| [AGENTS.md](file:///e:/projectanagement/AGENTS.md) | Conventions for coding agents |
| [MEMORY.md](file:///e:/projectanagement/MEMORY.md) | Context and progress tracker |

## Prerequisites

- Node.js (v22+ LTS line; detected v26.11.1 on host)
- npm (detected v11.20.0)
- Build toolchain for native modules (`better-sqlite3`, `argon2` / scrypt fallback)
- Modern web browser

## Setup (Planned)

```bash
npm install
cp .env.example .env
npm run dev
npm test
```
