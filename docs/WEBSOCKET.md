# WebSocket & Real-Time Collaboration

**Status:** Design only.  
**Related:** [ARCHITECTURE.md](file:///e:/projectanagement/docs/ARCHITECTURE.md), [SECURITY.md](file:///e:/projectanagement/docs/SECURITY.md), [API.md](file:///e:/projectanagement/docs/API.md).

---

## 1. Collaboration Model

- **Transport:** Socket.IO over same origin and port as REST API.
- **Directionality:** Server pushes data events to clients. Clients only emit 3 control events:
  1. `project:join`
  2. `project:leave`
  3. `presence:ping`
- **Writes:** All state changes occur via REST API. Sockets push broadcast events after the database transaction commits via `afterCommit(fn)`.

---

## 2. Rooms

| Room | Scope | Emitted Events |
| :--- | :--- | :--- |
| `user:<userId>` | Specific user | `notification:*`, `invitation:received`, `member:removed` |
| `session:<sessionId>` | Specific session | Targeted disconnects on logout / password change |
| `workspace:<workspaceId>` | Workspace members | `project:created`, `project:updated`, `project:deleted`, `member:*` |
| `project:<projectId>` | Project members | Board, column, task, subtask, comment, and presence events |

---

## 3. Event Envelope

```json
{
  "eventId": "uuid-v4",
  "type": "task:moved",
  "workspaceId": "uuid-v4",
  "projectId": "uuid-v4",
  "actorId": "uuid-v4",
  "originClientId": "per-tab-uuid-from-x-client-id",
  "ts": "2026-11-22T09:50:00.000Z",
  "data": {
    "taskId": "uuid",
    "fromColumnId": "uuid",
    "toColumnId": "uuid",
    "position": "a0",
    "version": 3,
    "completedAt": null
  }
}
```

---

## 4. Event Catalogue

- `project:created`, `project:updated`, `project:deleted`
- `board:updated`
- `column:created`, `column:updated`, `column:moved`, `column:deleted`, `column:rebalanced`
- `task:created`, `task:updated`, `task:moved`, `task:deleted`, `task:assignees_changed`
- `subtask:created`, `subtask:updated`, `subtask:deleted`
- `comment:created`, `comment:updated`, `comment:deleted`
- `member:added`, `member:removed`, `member:role_changed`
- `notification:new`, `notification:read`, `notification:read_all`
- `presence:state`, `presence:joined`, `presence:left`
- `invitation:received`

---

## 5. Concurrency & Optimistic UI Rules

1. **Echo Suppression:** Tab compares `originClientId` with its own tab ID; matches are ignored as the REST response already updated local state.
2. **Event Deduplication:** Client maintains a 200-item LRU cache of `eventId` to drop duplicate broadcasts.
3. **Version Guarding:** Mutations update `version`. Events with `data.version <= local.version` are dropped.
4. **Reconnect Convergence:** When reconnecting after network interruption, client refetches current project/board state to guarantee convergence.
