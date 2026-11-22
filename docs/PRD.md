# PRD: TeamBoard (working name)

**Status:** Draft for approval.  
**Date:** 2026-11-22.  
**Related:** [RESEARCH.md](file:///e:/projectanagement/docs/RESEARCH.md), [ARCHITECTURE.md](file:///e:/projectanagement/docs/ARCHITECTURE.md), [IMPLEMENTATION_PLAN.md](file:///e:/projectanagement/docs/IMPLEMENTATION_PLAN.md).

---

## 1. Summary

A collaborative project management web app: workspaces, projects, Kanban boards, tasks, discussions, notifications and real-time updates.  
**Goal:** A maintainable, secure, responsive, portfolio-quality full-stack application, inspired by (not copying) Trello, Asana, Linear and ClickUp.

---

## 2. Target Users

Students and college project teams, developers, startups, freelancers, small businesses and remote teams.  
**Team size assumption:** 2 to 30 people per workspace, tens of concurrent users. This drives the single-node architecture.

---

## 3. Hierarchy

```
Workspace -> Project -> Board -> Column -> Task -> Comment / Subtask / Attachment
```

- **Workspace is the tenant boundary:** No separate Organization entity in the MVP (ADR-002).
- **Default board:** Each project gets one default board automatically with 5 standard columns.

---

## 4. Primary User Journeys

| # | Journey | Result |
| :--- | :--- | :--- |
| **1** | Register | Account created, signed in, verification email sent (dev mailer logs to console). |
| **2** | Log in | Session cookie set, lands on last workspace. |
| **3** | Create a workspace | Creator becomes Owner; first-run empty state guides next steps. |
| **4** | Invite members | Admin or Owner enters email and role; invite link generated and emailed. |
| **5** | Accept invitation | Invitee opens link, signs in or registers, joins with invited role. |
| **6** | Create project | Name, description, visibility, dates, priority; auto-seeds default board. |
| **7** | Create board | Auto-created per project; multi-board is schema-supported. |
| **8** | Create columns | Add, rename, reorder, delete (requires moving tasks first). |
| **9** | Create task cards | Quick-add at bottom of column; details edited in side task panel. |
| **10** | Assign tasks | One or more assignees; assignees notified. |
| **11** | Update status | Status derived from column category; updated via drag, menu, or panel. |
| **12** | Drag and drop | Pointer and touch dragging, plus keyboard "Move to…" menu. |
| **13** | Comment | Threaded (one reply level), editable, deletable. |
| **14** | Mention | Typing `@` lists project members; mentioned user notified. |
| **15** | Notifications | Inbox with unread badge, real-time push via WebSockets. |
| **16** | Activity feed | Chronological audit trail per project. |
| **17** | Track progress | Done tasks over total, per project and on dashboard. |
| **18** | Account settings | Name, timezone, theme, notification preferences, password, sessions. |

---

## 5. Scope Tiers

### MVP (Phases 0 to 10, 11a, 12 to 14)
- **Auth:** Register, login, logout, session management, change password, forgot/reset password, email verification (switchable), profile.
- **Workspaces:** CRUD, switch, invite, accept, remove, role changes, ownership transfer (Owner, Admin, Member, Viewer).
- **Projects:** CRUD, archive, visibility (workspace/private), dates, priority, members, progress, activity feed.
- **Boards:** Default board, custom columns, drag and drop, board search and filters.
- **Tasks:** Title, description, column-as-status, priority, multiple assignees, reporter, dates, labels, subtasks, watchers, activity.
- **Comments:** Threaded (1 level), edit, delete, `@mentions`, avatars (initials), real-time.
- **Real-time:** Board, task, column, comment, member, notification, presence events via Socket.IO.
- **Notifications:** Triggered notifications, inbox, unread badge, mark read, preferences.
- **Dashboard:** Totals, completed, pending, overdue, my tasks, upcoming deadlines, activity.
- **Views:** Kanban Board and List view.
- **UX:** Light/dark mode, 375px–1440px responsive, skeletons, empty states, toasts, shortcuts.

### Post-MVP Extras (Phase 11b)
Global FTS5 search, file attachments & avatar upload, task dependencies, bulk task actions, CSV/JSON export, calendar view.

---

## 6. Functional Requirements (Testable)

- **FR-A1..A6:** Authentication validation, generic credential failures, session invalidation, single-use reset tokens.
- **FR-W1..W4:** Workspace owner invariants, role matrix enforcement, invitation expiry (7 days), typed name deletion.
- **FR-P1..P3:** Visibility boundaries (workspace vs. private), archived read-only guard, calculated progress.
- **FR-B1..B3:** 5 default columns (backlog, todo, in_progress, review, done), non-empty column deletion prevention, server-computed position ordering.
- **FR-T1..T6:** Task limits, status derived from column, assignee permissions, expectedVersion optimistic locking, auto-watchers.
- **FR-C1..C4:** 1-level reply nesting, author edit/delete, soft delete if replies exist, mention validation.
- **FR-R1..R3:** Project room authorization, immediate revocation on access change, reconnect refetch convergence.
- **FR-N1..N5:** 9 notification triggers, actor self-exclusion, reminder deduplication, customizable preferences.
- **FR-D1..D2:** Workspace-scoped dashboard metrics, timezone-aware date calculations.

---

## 7. Non-Functional Requirements

- **Security:** OWASP-aligned controls, server authorization, CSP, CSRF, parameterization.
- **Performance:** Board load under 300 ms server time for 500 tasks; paginated queries.
- **Reliability:** SQLite WAL mode, transactions with `afterCommit`, schema migrations.
- **Accessibility:** WCAG 2.2 AA target, full keyboard support, visible focus, ARIA live.
