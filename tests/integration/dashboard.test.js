import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';

describe('Dashboard and Analytics Integration (DB-* & FR-D1..D2)', () => {
  let appInstance;
  let baseUrl;
  let db;

  async function createAuthUser(email, name) {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password: 'Password123!' }),
    });
    const rawCookie = regRes.headers.get('set-cookie');
    const cookie = rawCookie.split(';')[0];

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie },
    });
    const meData = await meRes.json();
    return {
      user: meData.data.user,
      cookie,
      csrfToken: meData.data.csrfToken,
    };
  }

  before(async () => {
    appInstance = await createTestApp();
    baseUrl = appInstance.baseUrl;
    db = appInstance.db;
  });

  after(async () => {
    await appInstance.close();
  });

  test('DB-1 & DB-2: Workspace overview aggregations and private project exclusion', async () => {
    const owner = await createAuthUser('owner_db@teamboard.local', 'OwnerDB');
    const viewer = await createAuthUser('viewer_db@teamboard.local', 'ViewerDB');
    const outsider = await createAuthUser('outsider_db@teamboard.local', 'OutsiderDB');

    // 1. Create workspace
    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: owner.cookie,
        'X-CSRF-Token': owner.csrfToken,
      },
      body: JSON.stringify({ name: 'Analytics Workspace' }),
    });
    const ws = (await wsRes.json()).data;

    // Add viewer to workspace as 'member'
    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(ws.id, viewer.user.id);

    // 2. Create Public Project (visible to both owner and viewer)
    const pPublicRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: owner.cookie,
        'X-CSRF-Token': owner.csrfToken,
      },
      body: JSON.stringify({ name: 'Public Marketing', visibility: 'workspace' }),
    });
    const pPublic = (await pPublicRes.json()).data;

    // 3. Create Private Project (only owner is member, viewer is NOT member)
    const pPrivateRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: owner.cookie,
        'X-CSRF-Token': owner.csrfToken,
      },
      body: JSON.stringify({ name: 'Private Finances', visibility: 'private' }),
    });
    const pPrivate = (await pPrivateRes.json()).data;

    // Get columns for Public project
    const boardsPub = (
      await (await fetch(`${baseUrl}/api/projects/${pPublic.id}/boards`, { headers: { cookie: owner.cookie } })).json()
    ).data;
    const detailPub = (
      await (await fetch(`${baseUrl}/api/boards/${boardsPub[0].id}`, { headers: { cookie: owner.cookie } })).json()
    ).data;
    const colPubTodo = detailPub.columns.find((c) => c.category === 'todo');
    const colPubDone = detailPub.columns.find((c) => c.category === 'done');

    // Get columns for Private project
    const boardsPriv = (
      await (await fetch(`${baseUrl}/api/projects/${pPrivate.id}/boards`, { headers: { cookie: owner.cookie } })).json()
    ).data;
    const detailPriv = (
      await (await fetch(`${baseUrl}/api/boards/${boardsPriv[0].id}`, { headers: { cookie: owner.cookie } })).json()
    ).data;
    const colPrivTodo = detailPriv.columns.find((c) => c.category === 'todo');

    // Seed tasks in Public Project:
    // Task 1: Open, High priority, Overdue (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const t1 = (
      await (
        await fetch(`${baseUrl}/api/columns/${colPubTodo.id}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: owner.cookie,
            'X-CSRF-Token': owner.csrfToken,
          },
          body: JSON.stringify({
            title: 'Public Overdue High',
            priority: 'high',
            dueDate: yesterdayStr,
          }),
        })
      ).json()
    ).data;

    // Task 2: Completed, Urgent priority
    const t2 = (
      await (
        await fetch(`${baseUrl}/api/columns/${colPubDone.id}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: owner.cookie,
            'X-CSRF-Token': owner.csrfToken,
          },
          body: JSON.stringify({
            title: 'Public Done Urgent',
            priority: 'urgent',
          }),
        })
      ).json()
    ).data;

    // Seed task in Private Project:
    // Task 3: Open, Urgent priority
    const t3 = (
      await (
        await fetch(`${baseUrl}/api/columns/${colPrivTodo.id}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: owner.cookie,
            'X-CSRF-Token': owner.csrfToken,
          },
          body: JSON.stringify({
            title: 'Private Secret Task',
            priority: 'urgent',
          }),
        })
      ).json()
    ).data;

    // 4. Verify Owner Overview (can see both public and private)
    const ownerOverviewRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/dashboard/overview`, {
      headers: { cookie: owner.cookie },
    });
    assert.equal(ownerOverviewRes.status, 200);
    const ownerOverview = (await ownerOverviewRes.json()).data;

    assert.equal(ownerOverview.stats.totalTasks, 3);
    assert.equal(ownerOverview.stats.completedTasks, 1);
    assert.equal(ownerOverview.stats.inProgressTasks, 2);
    assert.equal(ownerOverview.stats.overdueTasks, 1);
    assert.equal(ownerOverview.stats.completionPercentage, 33);
    assert.equal(ownerOverview.stats.priorityDistribution.high, 1);
    assert.equal(ownerOverview.stats.priorityDistribution.urgent, 1); // 1 open urgent task (t3)
    assert.equal(ownerOverview.projects.length, 2);

    // 5. Verify Viewer Overview (DB-2: Private project isolation)
    const viewerOverviewRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/dashboard/overview`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(viewerOverviewRes.status, 200);
    const viewerOverview = (await viewerOverviewRes.json()).data;

    // Viewer should ONLY see the 2 tasks from the public project!
    assert.equal(viewerOverview.stats.totalTasks, 2);
    assert.equal(viewerOverview.stats.completedTasks, 1);
    assert.equal(viewerOverview.stats.inProgressTasks, 1);
    assert.equal(viewerOverview.stats.overdueTasks, 1);
    assert.equal(viewerOverview.stats.completionPercentage, 50);
    assert.equal(viewerOverview.stats.priorityDistribution.high, 1);
    assert.equal(viewerOverview.stats.priorityDistribution.urgent, 0); // private urgent task t3 excluded!
    assert.equal(viewerOverview.projects.length, 1);
    assert.equal(viewerOverview.projects[0].name, 'Public Marketing');

    // 6. DB-6: Outsider access to dashboard returns 404 (no leak)
    const outsiderRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/dashboard/overview`, {
      headers: { cookie: outsider.cookie },
    });
    assert.equal(outsiderRes.status, 404);
  });

  test('DB-3: My tasks listing and privacy isolation', async () => {
    const userA = await createAuthUser('user_a_db@teamboard.local', 'UserA');
    const userB = await createAuthUser('user_b_db@teamboard.local', 'UserB');

    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: userA.cookie,
        'X-CSRF-Token': userA.csrfToken,
      },
      body: JSON.stringify({ name: 'Tasks WS' }),
    });
    const ws = (await wsRes.json()).data;

    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(ws.id, userB.user.id);

    const projRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: userA.cookie,
        'X-CSRF-Token': userA.csrfToken,
      },
      body: JSON.stringify({ name: 'Tasks Project', visibility: 'workspace' }),
    });
    const proj = (await projRes.json()).data;

    const boards = (
      await (await fetch(`${baseUrl}/api/projects/${proj.id}/boards`, { headers: { cookie: userA.cookie } })).json()
    ).data;
    const detail = (
      await (await fetch(`${baseUrl}/api/boards/${boards[0].id}`, { headers: { cookie: userA.cookie } })).json()
    ).data;
    const colTodo = detail.columns.find((c) => c.category === 'todo');

    // Create task 1 assigned to UserB
    const t1 = (
      await (
        await fetch(`${baseUrl}/api/columns/${colTodo.id}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: userA.cookie,
            'X-CSRF-Token': userA.csrfToken,
          },
          body: JSON.stringify({ title: 'Assigned to B' }),
        })
      ).json()
    ).data;

    await fetch(`${baseUrl}/api/tasks/${t1.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: userA.cookie,
        'X-CSRF-Token': userA.csrfToken,
      },
      body: JSON.stringify({ userIds: [userB.user.id] }),
    });

    // Create task 2 assigned to UserA
    const t2 = (
      await (
        await fetch(`${baseUrl}/api/columns/${colTodo.id}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: userA.cookie,
            'X-CSRF-Token': userA.csrfToken,
          },
          body: JSON.stringify({ title: 'Assigned to A' }),
        })
      ).json()
    ).data;

    await fetch(`${baseUrl}/api/tasks/${t2.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: userA.cookie,
        'X-CSRF-Token': userA.csrfToken,
      },
      body: JSON.stringify({ userIds: [userA.user.id] }),
    });

    // UserB fetches my-tasks
    const bTasksRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/dashboard/my-tasks`, {
      headers: { cookie: userB.cookie },
    });
    assert.equal(bTasksRes.status, 200);
    const bTasks = (await bTasksRes.json()).data;

    assert.equal(bTasks.items.length, 1);
    assert.equal(bTasks.items[0].id, t1.id);
    assert.equal(bTasks.items[0].projectName, 'Tasks Project');
  });

  test('DB-4: Upcoming deadlines categorization (14 days)', async () => {
    const user = await createAuthUser('upcoming_db@teamboard.local', 'UpcomingDB');

    const ws = (
      await (
        await fetch(`${baseUrl}/api/workspaces`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: user.cookie,
            'X-CSRF-Token': user.csrfToken,
          },
          body: JSON.stringify({ name: 'Upcoming WS' }),
        })
      ).json()
    ).data;

    const proj = (
      await (
        await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: user.cookie,
            'X-CSRF-Token': user.csrfToken,
          },
          body: JSON.stringify({ name: 'Upcoming Project', visibility: 'workspace' }),
        })
      ).json()
    ).data;

    const boards = (
      await (await fetch(`${baseUrl}/api/projects/${proj.id}/boards`, { headers: { cookie: user.cookie } })).json()
    ).data;
    const detail = (
      await (await fetch(`${baseUrl}/api/boards/${boards[0].id}`, { headers: { cookie: user.cookie } })).json()
    ).data;
    const col = detail.columns[0];

    const todayDate = new Date().toISOString().split('T')[0];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const day5 = new Date();
    day5.setDate(day5.getDate() + 5);
    const day5Date = day5.toISOString().split('T')[0];

    const day10 = new Date();
    day10.setDate(day10.getDate() + 10);
    const day10Date = day10.toISOString().split('T')[0];

    // Seed task due today
    await fetch(`${baseUrl}/api/columns/${col.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: user.cookie,
        'X-CSRF-Token': user.csrfToken,
      },
      body: JSON.stringify({ title: 'Due Today Task', dueDate: todayDate }),
    });

    // Seed task due tomorrow
    await fetch(`${baseUrl}/api/columns/${col.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: user.cookie,
        'X-CSRF-Token': user.csrfToken,
      },
      body: JSON.stringify({ title: 'Due Tomorrow Task', dueDate: tomorrowDate }),
    });

    // Seed task due this week (day 5)
    await fetch(`${baseUrl}/api/columns/${col.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: user.cookie,
        'X-CSRF-Token': user.csrfToken,
      },
      body: JSON.stringify({ title: 'Due Day 5 Task', dueDate: day5Date }),
    });

    // Seed task due next week (day 10)
    await fetch(`${baseUrl}/api/columns/${col.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: user.cookie,
        'X-CSRF-Token': user.csrfToken,
      },
      body: JSON.stringify({ title: 'Due Day 10 Task', dueDate: day10Date }),
    });

    // Query upcoming
    const upcomingRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/dashboard/upcoming`, {
      headers: { cookie: user.cookie },
    });
    assert.equal(upcomingRes.status, 200);
    const upcomingData = (await upcomingRes.json()).data;

    assert.equal(upcomingData.today.length, 1);
    assert.equal(upcomingData.today[0].title, 'Due Today Task');

    assert.equal(upcomingData.tomorrow.length, 1);
    assert.equal(upcomingData.tomorrow[0].title, 'Due Tomorrow Task');

    assert.equal(upcomingData.thisWeek.length, 1);
    assert.equal(upcomingData.thisWeek[0].title, 'Due Day 5 Task');

    assert.equal(upcomingData.nextWeek.length, 1);
    assert.equal(upcomingData.nextWeek[0].title, 'Due Day 10 Task');
  });

  test('DB-5: Workspace activity feed', async () => {
    const user = await createAuthUser('act_db@teamboard.local', 'ActDB');

    const ws = (
      await (
        await fetch(`${baseUrl}/api/workspaces`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: user.cookie,
            'X-CSRF-Token': user.csrfToken,
          },
          body: JSON.stringify({ name: 'Act WS' }),
        })
      ).json()
    ).data;

    // Fetch activity
    const actRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/dashboard/activity`, {
      headers: { cookie: user.cookie },
    });
    assert.equal(actRes.status, 200);
    const actList = (await actRes.json()).data;

    assert.ok(Array.isArray(actList));
  });
});
