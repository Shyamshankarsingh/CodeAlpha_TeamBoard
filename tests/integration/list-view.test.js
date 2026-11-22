import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';
import { workspacesRepo } from '../../server/modules/workspaces/repo.js';

describe('Phase 11a: List View, Filters, and Search (TK-14)', () => {
  let testEnv;
  let owner;
  let member;
  let nonMember;
  let workspace;
  let project;
  let columns;
  let labels = [];
  let tasks = [];

  before(async () => {
    testEnv = await createTestApp({
      REQUIRE_EMAIL_VERIFICATION: 'false',
    });

    function getCookieValue(res, name = 'tb_session') {
      const rawCookie = res.headers.get('set-cookie');
      if (!rawCookie) return null;
      const match = rawCookie.match(new RegExp(`${name}=([^;]+)`));
      return match ? match[1] : null;
    }

    async function registerUser(email, name) {
      const res = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password: 'Password123!' }),
      });
      const data = await res.json();
      return {
        user: data.data.user,
        csrfToken: data.data.csrfToken,
        cookie: getCookieValue(res),
      };
    }

    owner = await registerUser('owner-list@example.com', 'List Owner');
    member = await registerUser('member-list@example.com', 'List Member');
    nonMember = await registerUser('outsider-list@example.com', 'Outsider');

    // Create workspace
    const wsRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'List Test Workspace' }),
    });
    workspace = (await wsRes.json()).data;

    // Add member to workspace
    workspacesRepo.addMember({
      workspaceId: workspace.id,
      userId: member.user.id,
      role: 'member',
    });

    // Create project
    const projRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${workspace.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'List Test Project', visibility: 'workspace' }),
    });
    project = (await projRes.json()).data;

    // Get boards & columns
    const boardListRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/boards`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const boards = (await boardListRes.json()).data;
    const boardDetailRes = await fetch(`${testEnv.baseUrl}/api/boards/${boards[0].id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const boardDetail = (await boardDetailRes.json()).data;
    columns = boardDetail.columns;

    // Create labels
    const l1Res = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Bug', color: '#EF4444' }),
    });
    labels.push((await l1Res.json()).data);

    const l2Res = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Feature', color: '#3B82F6' }),
    });
    labels.push((await l2Res.json()).data);

    // Create tasks
    const todoCol = columns.find((c) => c.category === 'todo');
    const inProgCol = columns.find((c) => c.category === 'in_progress');
    const doneCol = columns.find((c) => c.category === 'done');

    const todayStr = new Date().toISOString().slice(0, 10);
    const pastStr = '2020-01-01';
    const futureStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    // Task 1: Urgent bug, assigned to owner, due in past (overdue)
    const t1Res = await fetch(`${testEnv.baseUrl}/api/columns/${todoCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        title: 'Fix authentication vulnerability',
        description: 'Critical security issue in login token',
        priority: 'urgent',
        dueDate: pastStr,
      }),
    });
    const t1 = (await t1Res.json()).data;
    await fetch(`${testEnv.baseUrl}/api/tasks/${t1.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ userIds: [owner.user.id] }),
    });
    await fetch(`${testEnv.baseUrl}/api/tasks/${t1.id}/labels`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ labelIds: [labels[0].id] }),
    });
    tasks.push(t1);

    // Task 2: High feature, assigned to member, due today
    const t2Res = await fetch(`${testEnv.baseUrl}/api/columns/${inProgCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        title: 'Build table view',
        description: 'Add sortable list view with pagination',
        priority: 'high',
        dueDate: todayStr,
      }),
    });
    const t2 = (await t2Res.json()).data;
    await fetch(`${testEnv.baseUrl}/api/tasks/${t2.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ userIds: [member.user.id] }),
    });
    await fetch(`${testEnv.baseUrl}/api/tasks/${t2.id}/labels`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ labelIds: [labels[1].id] }),
    });
    tasks.push(t2);

    // Task 3: Low task, unassigned, due this week
    const t3Res = await fetch(`${testEnv.baseUrl}/api/columns/${inProgCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        title: 'Update documentation',
        description: 'Write developer docs for APIs',
        priority: 'low',
        dueDate: futureStr,
      }),
    });
    tasks.push((await t3Res.json()).data);

    // Task 4: Completed task in done column, priority medium, no due date
    const t4Res = await fetch(`${testEnv.baseUrl}/api/columns/${doneCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        title: 'Initial setup completed',
        description: 'Repo and config created',
        priority: 'medium',
      }),
    });
    tasks.push((await t4Res.json()).data);
  });

  after(async () => {
    if (testEnv) {
      await testEnv.close();
    }
  });

  test('GET /api/projects/:pid/tasks returns paginated tasks list', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/tasks`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.data);
    assert.equal(body.data.tasks.length, 4);
    assert.equal(body.data.pagination.total, 4);
    assert.equal(body.data.pagination.limit, 25);
    assert.equal(body.data.pagination.offset, 0);
    assert.equal(body.data.pagination.hasMore, false);
  });

  test('Filter by search keyword matches title and description', async () => {
    // Search by title "Fix"
    const res1 = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?search=Fix`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const body1 = await res1.json();
    assert.equal(body1.data.tasks.length, 1);
    assert.equal(body1.data.tasks[0].title, 'Fix authentication vulnerability');

    // Search by description "developer docs"
    const res2 = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?search=developer+docs`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const body2 = await res2.json();
    assert.equal(body2.data.tasks.length, 1);
    assert.equal(body2.data.tasks[0].title, 'Update documentation');
  });

  test('Filter by priority', async () => {
    const res = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?priority=urgent`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const body = await res.json();
    assert.equal(body.data.tasks.length, 1);
    assert.equal(body.data.tasks[0].priority, 'urgent');
  });

  test('Filter by column category', async () => {
    const res = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?category=in_progress`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const body = await res.json();
    assert.equal(body.data.tasks.length, 2);
    for (const t of body.data.tasks) {
      assert.equal(t.columnCategory, 'in_progress');
    }
  });

  test('Filter by assignee', async () => {
    const res = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?assigneeId=${member.user.id}`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const body = await res.json();
    assert.equal(body.data.tasks.length, 1);
    assert.equal(body.data.tasks[0].title, 'Build table view');
  });

  test('Filter by label', async () => {
    const res = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?labelId=${labels[0].id}`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const body = await res.json();
    assert.equal(body.data.tasks.length, 1);
    assert.equal(body.data.tasks[0].title, 'Fix authentication vulnerability');
  });

  test('Filter by dueDate range', async () => {
    // Overdue (due in 2020 and not completed)
    const overdueRes = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?dueDate=overdue`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const overdueBody = await overdueRes.json();
    assert.equal(overdueBody.data.tasks.length, 1);
    assert.equal(overdueBody.data.tasks[0].title, 'Fix authentication vulnerability');

    // Due Today
    const todayRes = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?dueDate=today`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const todayBody = await todayRes.json();
    assert.equal(todayBody.data.tasks.length, 1);
    assert.equal(todayBody.data.tasks[0].title, 'Build table view');

    // No Due Date
    const noneRes = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?dueDate=none`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const noneBody = await noneRes.json();
    assert.equal(noneBody.data.tasks.length, 1);
    assert.equal(noneBody.data.tasks[0].title, 'Initial setup completed');
  });

  test('Sorting by priority (asc and desc)', async () => {
    // ASC: urgent -> high -> medium -> low -> none
    const ascRes = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?sortBy=priority&sortDir=asc`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const ascBody = await ascRes.json();
    const prioritiesAsc = ascBody.data.tasks.map((t) => t.priority);
    assert.deepEqual(prioritiesAsc, ['urgent', 'high', 'medium', 'low']);

    // DESC: none -> low -> medium -> high -> urgent
    const descRes = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?sortBy=priority&sortDir=desc`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const descBody = await descRes.json();
    const prioritiesDesc = descBody.data.tasks.map((t) => t.priority);
    assert.deepEqual(prioritiesDesc, ['low', 'medium', 'high', 'urgent']);
  });

  test('Sorting by title', async () => {
    const res = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?sortBy=title&sortDir=asc`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const body = await res.json();
    const titles = body.data.tasks.map((t) => t.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(titles, sorted);
  });

  test('Pagination with limit and offset', async () => {
    const page1Res = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?limit=2&offset=0`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const page1 = await page1Res.json();
    assert.equal(page1.data.tasks.length, 2);
    assert.equal(page1.data.pagination.total, 4);
    assert.equal(page1.data.pagination.hasMore, true);

    const page2Res = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?limit=2&offset=2`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    const page2 = await page2Res.json();
    assert.equal(page2.data.tasks.length, 2);
    assert.equal(page2.data.pagination.hasMore, false);

    // Verify disjoint sets of IDs
    const ids1 = new Set(page1.data.tasks.map((t) => t.id));
    for (const t of page2.data.tasks) {
      assert.ok(!ids1.has(t.id));
    }
  });

  test('Authorization: Unauthenticated access returns 401', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/tasks`);
    assert.equal(res.status, 401);
  });

  test('IDOR protection: Non-member user gets 404', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/tasks`, {
      headers: { Cookie: `tb_session=${nonMember.cookie}` },
    });
    assert.equal(res.status, 404);
  });

  test('SQL injection attempt in sortBy is rejected with validation error', async () => {
    const res = await fetch(
      `${testEnv.baseUrl}/api/projects/${project.id}/tasks?sortBy=title;DROP+TABLE+tasks--`,
      { headers: { Cookie: `tb_session=${owner.cookie}` } }
    );
    assert.equal(res.status, 400);
  });
});
