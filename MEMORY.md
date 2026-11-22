# Memory & Project State

Context for coding sessions. Update at the end of every phase.  
**Last updated:** 2026-11-22.

---

## Current State

- **Stage:** Phase 13 complete and verified. Ready for Phase 14 approval.
- **Code:**
  - Responsive Design & Viewport Adaptations (`DESIGN.md`):
    - Mobile (375px–390px): Off-canvas navigation drawer with hamburger toggle (`tb-menu-toggle`), slide-over transition, backdrop overlay (`tb-sidebar-backdrop`), horizontal Kanban scroll snap with 85vw columns, full-screen mobile task sheet, and zero horizontal page scroll.
    - Tablet (769px–1024px): Collapsible icon-rail sidebar (68px width) with centered icons and labels collapsed; 70vw responsive modal sheets.
    - Desktop (1025px+): Full 250px sidebar with workspace switcher, navigation links, and 520px side task sheet.
  - Landing Page (`public/js/pages/landing.js`):
    - High-conversion, portfolio-quality landing page rendered at `/` for guest visitors.
    - Hero section with live value propositions and direct CTAs ("Get Started Free" -> `/register`, "Sign In" -> `/login`).
    - 4-column feature highlights grid (Real-Time Kanban, Multi-View Table & Filters, Threaded Discussions, Zero-Trust Security).
    - Windowed live interactive Kanban preview mockup (To Do, In Progress, Done with priority badges).
    - Footer with theme toggle, copyright, and keyboard shortcuts guidance.
  - Theme Switcher (`public/js/components/theme-toggle.js`):
    - Light/Dark mode switcher button (☀️ / 🌙) in topbar, header, and landing page.
    - Follows `prefers-color-scheme: dark` by default and persists user choice to `localStorage` (`tb_theme`).
  - Global Keyboard Shortcuts (`public/js/lib/shortcuts.js` & `public/js/components/shortcuts-modal.js`):
    - Implemented global hotkeys: `/` (focus search), `c` (create task), `?` (show shortcuts dialog), `Esc` (close open modal/panel), and `g` chords (`g b` for Board, `g l` for List, `g i` for Notifications inbox).
    - Accessible shortcuts help modal with `<kbd>` badges.
  - Accessibility & Focus Trapping (`public/js/components/dialog.js`):
    - Modal dialogs trap keyboard focus (`Tab` and `Shift+Tab`), focus initial control on opening, restore previous focus on close, and dismiss on `Escape`.
- **Tests:** 162 tests passing across 32 suites (`npm test`).
- **Repository:** Phase 13 ready to commit (`phase-13: responsive design and ux refinement`).
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
| **13** | Responsive design and UX refinement | Completed |
| **14** | Deployment and production readiness | Ready to begin |
