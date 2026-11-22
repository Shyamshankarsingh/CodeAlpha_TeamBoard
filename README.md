# TeamBoard

A collaborative, real-time project management web platform: workspaces, projects, Kanban boards with fractional positioning, multi-dimensional task list views, threaded discussions with `@mentions`, and instant notifications.

Inspired by Linear, Trello, and ClickUp, built entirely with vanilla JavaScript (Node ES modules, zero frontend frameworks, zero bundlers), Express 5, SQLite via `better-sqlite3` in WAL mode, and Socket.IO.

---

## Features

- **Workspaces & Multi-Tenancy:** Role-based access control (Owner, Admin, Member, Viewer), workspace invitations, and member management.
- **Projects & Permissions:** Public workspace-wide projects and restricted private projects.
- **Real-Time Kanban Boards:** Live drag-and-drop workflow powered by Socket.IO, fractional position math (Base-62), custom column categories, and live presence avatars.
- **List View & Multi-Criteria Filtering:** Responsive sortable table view, filterable by text search, status, priority, due date range, assignee, and labels with two-way URL parameter persistence.
- **Task Management:** Priorities (Urgent, High, Medium, Low, None), due dates, project-scoped colored labels, multi-assignees, subtasks with completion checklists, and watchers.
- **Threaded Discussions:** In-task comments with 1-level reply nesting, `@mentions`, auto-watching, and edit/delete capabilities.
- **Notification Inbox:** Real-time push notifications, unread badge counter, and automated reminder/overdue deduplication.
- **Workspace Analytics:** Centralized overview with task completion metrics, upcoming 14-day deadlines, and audit activity streams.
- **Zero-Trust Security:** Centralized server-side authorization (`lib/permissions.js`), Argon2id password hashing, CSRF synchronizer tokens, strict Origin checks, strict Content Security Policy, and 100% pure DOM text rendering (zero `innerHTML` sinks across the entire client).
- **Responsive UX & Design System:** WCAG 2.1 AA compliance, Light/Dark mode switcher, mobile drawer navigation (375px–390px scroll-snap), and global keyboard shortcuts (`/`, `c`, `?`, `Esc`, `g b`, `g l`, `g i`).

---

## Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES modules) | Pure DOM `h()` builder with `textContent`, CSS design tokens (`tokens.css`), zero frameworks, zero bundlers |
| **Backend** | Node.js (v20+ / v22+ LTS), Express 5 | Modular layered architecture: Routes -> Services -> Repositories |
| **Database** | SQLite via `better-sqlite3` | WAL mode, foreign keys enforced, transaction helper, automated migrations |
| **Real-Time** | Socket.IO | Room-based event broadcasting, presence tracking, and client deduplication |
| **Auth & Security** | Argon2id, SHA-256 session tokens | Helmet, strict CSP, Origin validation, CSRF tokens, rate limiting |

---

## Getting Started

### Prerequisites

- Node.js >= 20.x or 22.x LTS
- npm >= 10.x

### Installation

```bash
# Clone the repository
git clone https://github.com/example/teamboard.git
cd teamboard

# Install dependencies
npm install

# Start in development mode (with node --watch)
npm run dev

# Run all automated tests (node --test)
npm test

# Run automated database backup
npm run backup

# Start in production mode
npm start
```

Open `http://localhost:3000` in your browser.

---

## Project Structure

```
├── public/                 # Static frontend files (Vanilla ES modules)
│   ├── assets/css/         # Tokens, base, layout, components, pages
│   ├── js/
│   │   ├── components/     # Reusable UI components (avatar, dialog, table, filter-bar, etc.)
│   │   ├── lib/            # DOM builder, WebSocket client, keyboard shortcuts
│   │   ├── pages/          # Page views (landing, board, dashboard, login, etc.)
│   │   ├── main.js         # Client bootstrap and routing
│   │   └── store.js        # Centralized client reactive store
│   └── index.html          # SPA HTML shell
├── server/                 # Express backend application
│   ├── db/                 # SQLite connection, WAL pragmas, migrations
│   ├── lib/                # Math engine, event bus, permissions, logger, errors
│   ├── middleware/         # Security headers, CSRF, Origin check, rate limit, sessions
│   ├── modules/            # Domain modules (auth, workspaces, projects, boards, tasks, comments, notifications, dashboard)
│   └── app.js              # Express app definition and routing
├── scripts/                # Utility scripts (backup.js)
├── tests/                  # Automated test suite (node --test)
│   ├── db/                 # Schema and transaction rollback tests
│   ├── integration/        # End-to-end HTTP and WebSocket integration tests
│   └── unit/               # Math, permissions, and security unit tests
└── docs/                   # System documentation and architecture records
```

---

## Production Deployment

Refer to [docs/DEPLOYMENT.md](file:///e:/projectanagement/docs/DEPLOYMENT.md) for complete instructions:
- Docker containerization (`docker build -t teamboard .`)
- Nginx reverse proxy configuration with TLS/SSL and WebSockets
- Systemd service configuration
- Automated daily backups and disaster recovery runbook

---

## License

UNLICENSED. Portfolio and demonstration project.
