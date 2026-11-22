# REST API Specification

**Status:** Design only.  
**Related:** [DATABASE.md](file:///e:/projectanagement/docs/DATABASE.md), [SECURITY.md](file:///e:/projectanagement/docs/SECURITY.md), [WEBSOCKET.md](file:///e:/projectanagement/docs/WEBSOCKET.md).

---

## 1. Conventions

- **Base path:** `/api`
- **Format:** JSON only
- **Authentication:** HttpOnly session cookie
- **Mutations (POST, PATCH, PUT, DELETE):** Require `Content-Type: application/json`, verified `Origin: APP_ORIGIN`, and `X-CSRF-Token` header.
- **Echo suppression:** Optional `X-Client-Id` header (per-tab UUID).
- **Envelopes:**
  - Success: `{ "data": ..., "meta": { ... } }`
  - Error:
    ```json
    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Human readable message",
        "details": [{ "path": "title", "message": "Required" }],
        "requestId": "uuid"
      }
    }
    ```

---

## 2. API Endpoints by Domain

### 2.1 Auth (`/api/auth`)
- `POST /register`: Register user account.
- `POST /login`: Log in, set session cookie, return CSRF token.
- `POST /logout`: Invalidate session and clear cookie.
- `GET /me`: Current user profile, CSRF token, and workspace memberships.
- `POST /verify-email`, `POST /resend-verification`: Verification lifecycle.
- `POST /forgot-password`, `POST /reset-password`, `POST /change-password`: Password management.
- `GET /sessions`, `DELETE /sessions/:id`, `POST /sessions/revoke-others`: Session management.

### 2.2 Users (`/api/users`)
- `PATCH /me`: Update profile (name, timezone, theme, notification preferences).
- `GET /search`: Search workspace members for mentions/assignees.
- `GET /:id`: View user summary.

### 2.3 Workspaces (`/api/workspaces`)
- `GET /`, `POST /`: List and create workspaces.
- `GET /:id`, `PATCH /:id`, `DELETE /:id`: Workspace CRUD.
- `POST /:id/transfer-ownership`: Transfer workspace ownership.
- `GET /:id/members`, `PATCH /:id/members/:userId`, `DELETE /:id/members/:userId`: Membership and role management.
- `GET /:id/invitations`, `POST /:id/invitations`, `DELETE /:id/invitations/:invId`: Invitation management.
- `POST /api/invitations/preview`, `POST /api/invitations/accept`, `GET /api/invitations/mine`: Invitation acceptance.

### 2.4 Projects (`/api/projects` & `/api/workspaces/:wid/projects`)
- `GET /workspaces/:wid/projects`, `POST /workspaces/:wid/projects`: List and create projects.
- `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id`: Project CRUD.
- `POST /projects/:id/archive`, `POST /projects/:id/unarchive`: Project archiving.
- `GET /projects/:id/members`, `POST /projects/:id/members`, `DELETE /projects/:id/members/:userId`: Project members.
- `GET /projects/:id/activity`: Project activity audit feed.

### 2.5 Boards & Columns
- `GET /projects/:pid/boards`, `POST /projects/:pid/boards`: Boards in project.
- `GET /boards/:id`: Comprehensive board payload (columns + task cards).
- `PATCH /boards/:id`, `DELETE /boards/:id`: Board management.
- `POST /boards/:id/columns`: Add column.
- `PATCH /columns/:id`, `POST /columns/:id/move`, `DELETE /columns/:id`: Column management (with task move).

### 2.6 Tasks (`/api/tasks`)
- `GET /projects/:pid/tasks`: List view tasks with filters, sorting, and pagination.
- `POST /columns/:cid/tasks`: Quick-add or detailed task creation.
- `GET /tasks/:id`, `PATCH /tasks/:id`, `DELETE /tasks/:id`: Task operations.
- `POST /tasks/:id/move`: Drag/keyboard move (updates column and server-calculated position).
- `POST /tasks/:id/duplicate`, `POST /tasks/:id/archive`, `POST /tasks/:id/unarchive`: Task actions.
- `PUT /tasks/:id/assignees`: Update assignees.
- `PUT /tasks/:id/labels`: Update labels.
- `POST /tasks/:id/watchers`, `DELETE /tasks/:id/watchers`: Watch/unwatch task.
- `POST /tasks/:id/subtasks`, `PATCH /subtasks/:id`, `POST /subtasks/:id/move`, `DELETE /subtasks/:id`: Subtasks.

### 2.7 Comments (`/api/tasks/:id/comments`)
- `GET /tasks/:id/comments`, `POST /tasks/:id/comments`: Threaded comments (1 level).
- `PATCH /comments/:id`, `DELETE /comments/:id`: Edit and delete comment (soft delete if replies exist).

### 2.8 Notifications (`/api/notifications`)
- `GET /`: Cursor-paginated notification feed.
- `GET /unread-count`: Badge count.
- `POST /:id/read`, `POST /read-all`: Mark read.
- `DELETE /:id`: Dismiss notification.

### 2.9 Dashboard (`/api/workspaces/:wid/dashboard`)
- `GET /overview`: Workspace totals, progress, task distributions.
- `GET /my-tasks`: Paginated list of tasks assigned to actor.
- `GET /upcoming`: Tasks due in the next 14 days.
- `GET /activity`: Filtered workspace activity.
