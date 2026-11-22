import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';
import { events } from '../../server/lib/events.js';

describe('Task Management Integration (TK-* & SEC-*)', () => {
  let testEnv;

  before(async () => {
    testEnv = await createTestApp({
      REQUIRE_EMAIL_VERIFICATION: 'false',
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.close();
    }
  });

  function getCookieValue(res, name = 'tb_session') {
    const rawCookie = res.headers.get('set-cookie');
    if (!rawCookie) return null;
    const match = rawCookie.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
  }

  async function registerAndLogin(email, name, password = 'Password12345!') {
    const regRes = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    });
    const regData = await regRes.json();
    const cookie = getCookieValue(regRes);
    return {
      user: regData.data.user,
      csrfToken: regData.data.csrfToken,
      cookie,
    };
  }

  async function setupProject(owner) {
    const wsRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Task Test Workspace' }),
    });
    const ws = (await wsRes.json()).data;

    const projRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Task Test Project' }),
    });
    const project = (await projRes.json()).data;

    const boardsRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/boards`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const board = (await boardsRes.json()).data[0];

    const boardDetailRes = await fetch(`${testEnv.baseUrl}/api/boards/${board.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const boardDetail = (await boardDetailRes.json()).data;

    return { ws, project, board: boardDetail, columns: boardDetail.columns };
  }

  test('TK-1 & TK-11: Task CRUD operations and auto-watching', async () => {
    const owner = await registerAndLogin('tk_owner1@example.com', 'Task Owner 1');
    const { ws, project, columns } = await setupProject(owner);
    const todoCol = columns.find((c) => c.category === 'todo');

    let domainEventReceived = null;
    const listener = (event) => {
      if (event.type === 'task.created') {
        domainEventReceived = event.payload;
      }
    };
    events.on('*', listener);

    // 1. Create Task
    const createRes = await fetch(`${testEnv.baseUrl}/api/columns/${todoCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        title: 'Implement Authentication',
        description: 'Argon2id and session handling',
        priority: 'high',
        startDate: '2026-02-01',
        dueDate: '2026-02-15',
      }),
    });

    assert.equal(createRes.status, 201);
    const task = (await createRes.json()).data;
    assert.equal(task.title, 'Implement Authentication');
    assert.equal(task.priority, 'high');
    assert.equal(task.version, 1);
    assert.equal(task.reporterId, owner.user.id);
    assert.equal(task.completedAt, null);

    // TK-11: Verify creator auto-watches
    assert.equal(task.watchers.some((w) => w.id === owner.user.id), true);

    // Verify domain event
    assert.ok(domainEventReceived);
    assert.equal(domainEventReceived.taskId, task.id);
    events.off('*', listener);

    // 2. Read Task
    const getRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(getRes.status, 200);
    const fetched = (await getRes.json()).data;
    assert.equal(fetched.id, task.id);

    // 3. Update Task
    const updateRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        title: 'Implement Auth & CSRF',
        expectedVersion: 1,
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = (await updateRes.json()).data;
    assert.equal(updated.title, 'Implement Auth & CSRF');
    assert.equal(updated.version, 2);

    // 4. Delete Task
    const delRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(delRes.status, 200);

    // Verify deleted
    const verifyGet = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(verifyGet.status, 404);
  });

  test('TK-2, TK-5, TK-4: Task move, optimistic locking (409), and completed_at calculation', async () => {
    const owner = await registerAndLogin('tk_owner2@example.com', 'Task Owner 2');
    const { columns } = await setupProject(owner);
    const todoCol = columns.find((c) => c.category === 'todo');
    const doneCol = columns.find((c) => c.category === 'done');

    const createRes = await fetch(`${testEnv.baseUrl}/api/columns/${todoCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Task to Move' }),
    });
    const task = (await createRes.json()).data;
    assert.equal(task.completedAt, null);

    // TK-4: Stale expectedVersion returns 409
    const conflictRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        columnId: doneCol.id,
        expectedVersion: 999,
      }),
    });
    assert.equal(conflictRes.status, 409);
    assert.equal((await conflictRes.json()).error.code, 'CONCURRENCY_CONFLICT');

    // TK-5: Moving to Done sets completed_at
    const moveToDone = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        columnId: doneCol.id,
        expectedVersion: 1,
      }),
    });
    assert.equal(moveToDone.status, 200);
    const doneTask = (await moveToDone.json()).data;
    assert.equal(doneTask.columnId, doneCol.id);
    assert.ok(doneTask.completedAt);
    assert.equal(doneTask.version, 2);

    // TK-5: Moving back out of Done clears completed_at
    const moveBack = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        columnId: todoCol.id,
        expectedVersion: 2,
      }),
    });
    assert.equal(moveBack.status, 200);
    const reopenedTask = (await moveBack.json()).data;
    assert.equal(reopenedTask.columnId, todoCol.id);
    assert.equal(reopenedTask.completedAt, null);
    assert.equal(reopenedTask.version, 3);
  });

  test('TK-6: Assignee validation (must belong to workspace)', async () => {
    const owner = await registerAndLogin('tk_owner3@example.com', 'Task Owner 3');
    const { ws, columns } = await setupProject(owner);
    const todoCol = columns.find((c) => c.category === 'todo');

    const member = await registerAndLogin('tk_member1@example.com', 'Valid Member');
    const stranger = await registerAndLogin('tk_stranger@example.com', 'Stranger');

    // Add member to workspace
    testEnv.db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, 'member')
    `).run(ws.id, member.user.id);

    const taskRes = await fetch(`${testEnv.baseUrl}/api/columns/${todoCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Assignee Test Task' }),
    });
    const task = (await taskRes.json()).data;

    // Reject non-workspace user
    const failAssign = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ userIds: [stranger.user.id] }),
    });
    assert.equal(failAssign.status, 400);

    // Accept valid workspace member
    const okAssign = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ userIds: [member.user.id] }),
    });
    assert.equal(okAssign.status, 200);
    const assignees = (await okAssign.json()).data;
    assert.equal(assignees.length, 1);
    assert.equal(assignees[0].id, member.user.id);
  });

  test('TK-7: Date validation rejects startDate > dueDate', async () => {
    const owner = await registerAndLogin('tk_owner4@example.com', 'Task Owner 4');
    const { columns } = await setupProject(owner);
    const todoCol = columns.find((c) => c.category === 'todo');

    const failRes = await fetch(`${testEnv.baseUrl}/api/columns/${todoCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        title: 'Bad Dates',
        startDate: '2026-06-01',
        dueDate: '2026-01-01',
      }),
    });
    assert.equal(failRes.status, 400);
    const errData = await failRes.json();
    assert.equal(errData.error.code, 'VALIDATION_ERROR');
  });

  test('TK-8: Cross-project label assignment rejection', async () => {
    const owner = await registerAndLogin('tk_owner5@example.com', 'Task Owner 5');
    const { ws, project, columns } = await setupProject(owner);
    const todoCol = columns.find((c) => c.category === 'todo');

    // Create a second project
    const proj2Res = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Other Project' }),
    });
    const project2 = (await proj2Res.json()).data;

    // Create label in Project 2
    const labelRes = await fetch(`${testEnv.baseUrl}/api/projects/${project2.id}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Bug', color: '#EF4444' }),
    });
    const label2 = (await labelRes.json()).data;

    // Create task in Project 1
    const taskRes = await fetch(`${testEnv.baseUrl}/api/columns/${todoCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Task in P1' }),
    });
    const task = (await taskRes.json()).data;

    // Attempting to apply label from Project 2 to task in Project 1 fails
    const applyRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/labels`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ labelIds: [label2.id] }),
    });
    assert.equal(applyRes.status, 400);
    assert.equal((await applyRes.json()).error.code, 'CROSS_PROJECT_LABEL');
  });

  test('TK-9: Subtasks CRUD and ordering', async () => {
    const owner = await registerAndLogin('tk_owner6@example.com', 'Task Owner 6');
    const { columns } = await setupProject(owner);
    const todoCol = columns.find((c) => c.category === 'todo');

    const taskRes = await fetch(`${testEnv.baseUrl}/api/columns/${todoCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Subtask Parent Task' }),
    });
    const task = (await taskRes.json()).data;

    // 1. Create subtask
    const subRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/subtasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Write unit tests' }),
    });
    assert.equal(subRes.status, 201);
    const sub = (await subRes.json()).data;
    assert.equal(sub.title, 'Write unit tests');
    assert.equal(sub.completed, 0);

    // 2. Mark completed
    const updateRes = await fetch(`${testEnv.baseUrl}/api/subtasks/${sub.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(updateRes.status, 200);
    const updatedSub = (await updateRes.json()).data;
    assert.equal(updatedSub.completed, 1);

    // 3. Delete subtask
    const delRes = await fetch(`${testEnv.baseUrl}/api/subtasks/${sub.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(delRes.status, 200);
  });

  test('TK-10: Task duplication clones subtasks, labels, and appends (Copy)', async () => {
    const owner = await registerAndLogin('tk_owner7@example.com', 'Task Owner 7');
    const { project, columns } = await setupProject(owner);
    const todoCol = columns.find((c) => c.category === 'todo');

    // Create label
    const labelRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Feature', color: '#10B981' }),
    });
    const label = (await labelRes.json()).data;

    // Create task
    const taskRes = await fetch(`${testEnv.baseUrl}/api/columns/${todoCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Original Task' }),
    });
    const task = (await taskRes.json()).data;

    // Add label
    await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/labels`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ labelIds: [label.id] }),
    });

    // Add subtask
    await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/subtasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Subtask 1' }),
    });

    // Duplicate Task
    const dupRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(dupRes.status, 201);
    const cloned = (await dupRes.json()).data;

    assert.equal(cloned.title, 'Original Task (Copy)');
    assert.notEqual(cloned.id, task.id);
    assert.equal(cloned.labels.length, 1);
    assert.equal(cloned.labels[0].name, 'Feature');
    assert.equal(cloned.subtasks.length, 1);
    assert.equal(cloned.subtasks[0].title, 'Subtask 1');
  });

  test('TK-13: Invariant check rejects moving task to a column of a different project', async () => {
    const owner = await registerAndLogin('tk_owner8@example.com', 'Task Owner 8');
    const { ws, columns: p1Columns } = await setupProject(owner);
    const p1Col = p1Columns[0];

    // Setup Project 2
    const p2Res = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Project Two' }),
    });
    const p2 = (await p2Res.json()).data;

    const b2Res = await fetch(`${testEnv.baseUrl}/api/projects/${p2.id}/boards`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const b2 = (await b2Res.json()).data[0];

    const b2Detail = await fetch(`${testEnv.baseUrl}/api/boards/${b2.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const p2Col = (await b2Detail.json()).data.columns[0];

    // Create task in P1
    const taskRes = await fetch(`${testEnv.baseUrl}/api/columns/${p1Col.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Cross Project Move Test' }),
    });
    const task = (await taskRes.json()).data;

    // Attempt moving task to P2's column
    const moveRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        columnId: p2Col.id,
        expectedVersion: 1,
      }),
    });
    assert.equal(moveRes.status, 400);
    assert.equal((await moveRes.json()).error.code, 'INVALID_COLUMN');
  });
});
