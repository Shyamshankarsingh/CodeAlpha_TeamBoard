import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io as ioClient } from 'socket.io-client';
import { createTestApp } from '../helpers/app.js';

describe('Notification System Integration (NT-* & FR-N1..N5)', () => {
  let appInstance;
  let baseUrl;
  let db;

  async function createAuthUser(email, name, prefs = {}) {
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

    if (Object.keys(prefs).length > 0) {
      db.prepare('UPDATE users SET notification_prefs = ? WHERE id = ?').run(
        JSON.stringify(prefs),
        meData.data.user.id
      );
    }

    return {
      user: meData.data.user,
      cookie,
      csrfToken: meData.data.csrfToken,
    };
  }

  function connectSocket(cookie) {
    return new Promise((resolve) => {
      const socket = ioClient(baseUrl, {
        extraHeaders: {
          cookie: cookie || '',
          origin: 'http://localhost',
        },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: false,
      });

      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => resolve({ error: err, socket }));
    });
  }

  before(async () => {
    appInstance = await createTestApp();
    baseUrl = appInstance.baseUrl;
    db = appInstance.db;
  });

  after(async () => {
    await appInstance.close();
  });

  // FR-N1 & FR-N2: Trigger task_assigned, task_unassigned, and actor self-exclusion
  test('NT-1: task_assigned and task_unassigned triggers with actor self-exclusion', async () => {
    const alice = await createAuthUser('alice_nt1@teamboard.local', 'Alice');
    const bob = await createAuthUser('bob_nt1@teamboard.local', 'Bob');

    // Alice creates workspace and project
    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: alice.cookie,
        'X-CSRF-Token': alice.csrfToken,
      },
      body: JSON.stringify({ name: 'Alice WS' }),
    });
    const ws = (await wsRes.json()).data;

    // Add Bob to workspace
    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(ws.id, bob.user.id);

    const projRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: alice.cookie,
        'X-CSRF-Token': alice.csrfToken,
      },
      body: JSON.stringify({ name: 'Project 1', visibility: 'workspace' }),
    });
    const proj = (await projRes.json()).data;

    // Get first column
    const boardsRes = await fetch(`${baseUrl}/api/projects/${proj.id}/boards`, {
      headers: { cookie: alice.cookie },
    });
    const boards = (await boardsRes.json()).data;
    const boardDetailRes = await fetch(`${baseUrl}/api/boards/${boards[0].id}`, {
      headers: { cookie: alice.cookie },
    });
    const boardDetail = (await boardDetailRes.json()).data;
    const firstCol = boardDetail.columns[0];

    // Alice creates a task
    const taskRes = await fetch(`${baseUrl}/api/columns/${firstCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: alice.cookie,
        'X-CSRF-Token': alice.csrfToken,
      },
      body: JSON.stringify({ title: 'Task with Assignees' }),
    });
    const task = (await taskRes.json()).data;

    // Connect Bob's socket to test real-time notification push
    const bobSocket = await connectSocket(bob.cookie);
    const notificationPromise = new Promise((resolve) => {
      bobSocket.on('notification:new', (envelope) => resolve(envelope));
    });

    // 1. Alice assigns Bob AND Alice to task
    const assignRes = await fetch(`${baseUrl}/api/tasks/${task.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: alice.cookie,
        'X-CSRF-Token': alice.csrfToken,
      },
      body: JSON.stringify({ userIds: [bob.user.id, alice.user.id] }),
    });
    assert.equal(assignRes.status, 200);

    // Wait for Bob's real-time socket event
    const envelope = await notificationPromise;
    assert.equal(envelope.type, 'notification:new');
    assert.equal(envelope.data.type, 'task_assigned');

    // Verify Bob's notification feed
    const bobFeedRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { cookie: bob.cookie },
    });
    const bobFeed = (await bobFeedRes.json()).data;
    assert.equal(bobFeed.items.length, 1);
    assert.equal(bobFeed.items[0].type, 'task_assigned');
    assert.equal(bobFeed.items[0].actor.id, alice.user.id);

    // FR-N2: Verify Alice (the actor who assigned herself) has NO notification (self-exclusion)
    const aliceFeedRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { cookie: alice.cookie },
    });
    const aliceFeed = (await aliceFeedRes.json()).data;
    assert.equal(aliceFeed.items.length, 0);

    // 2. Alice unassigns Bob
    const unassignRes = await fetch(`${baseUrl}/api/tasks/${task.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: alice.cookie,
        'X-CSRF-Token': alice.csrfToken,
      },
      body: JSON.stringify({ userIds: [alice.user.id] }),
    });
    assert.equal(unassignRes.status, 200);

    // Verify Bob received task_unassigned notification
    const bobFeedAfterRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { cookie: bob.cookie },
    });
    const bobFeedAfter = (await bobFeedAfterRes.json()).data;
    assert.equal(bobFeedAfter.items.length, 2);
    assert.equal(bobFeedAfter.items[0].type, 'task_unassigned');

    bobSocket.close();
  });

  // FR-N1: Trigger comment_mention and comment_created
  test('NT-2: comment_mention and comment_created on watched tasks', async () => {
    const carol = await createAuthUser('carol_nt2@teamboard.local', 'Carol');
    const dave = await createAuthUser('dave_nt2@teamboard.local', 'Dave');
    const eve = await createAuthUser('eve_nt2@teamboard.local', 'Eve');

    // Carol creates workspace & project
    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: carol.cookie,
        'X-CSRF-Token': carol.csrfToken,
      },
      body: JSON.stringify({ name: 'Carol WS' }),
    });
    const ws = (await wsRes.json()).data;

    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
             (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(ws.id, dave.user.id, ws.id, eve.user.id);

    const projRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: carol.cookie,
        'X-CSRF-Token': carol.csrfToken,
      },
      body: JSON.stringify({ name: 'Project 2', visibility: 'workspace' }),
    });
    const proj = (await projRes.json()).data;

    // Get board column
    const boardsRes = await fetch(`${baseUrl}/api/projects/${proj.id}/boards`, {
      headers: { cookie: carol.cookie },
    });
    const boards = (await boardsRes.json()).data;
    const boardDetailRes = await fetch(`${baseUrl}/api/boards/${boards[0].id}`, {
      headers: { cookie: carol.cookie },
    });
    const boardDetail = (await boardDetailRes.json()).data;
    const firstCol = boardDetail.columns[0];

    // Carol creates task
    const taskRes = await fetch(`${baseUrl}/api/columns/${firstCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: carol.cookie,
        'X-CSRF-Token': carol.csrfToken,
      },
      body: JSON.stringify({ title: 'Discussion Task' }),
    });
    const task = (await taskRes.json()).data;

    // Eve watches the task
    db.prepare(`
      INSERT INTO task_watchers (task_id, user_id, created_at)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(task.id, eve.user.id);

    // Carol comments and mentions Dave (@Dave)
    const commentRes = await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: carol.cookie,
        'X-CSRF-Token': carol.csrfToken,
      },
      body: JSON.stringify({
        body: 'Hello @Dave check this!',
        mentions: [dave.user.id],
      }),
    });
    assert.equal(commentRes.status, 201);

    // Dave should receive comment_mention
    const daveFeedRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { cookie: dave.cookie },
    });
    const daveFeed = (await daveFeedRes.json()).data;
    assert.equal(daveFeed.items.length, 1);
    assert.equal(daveFeed.items[0].type, 'comment_mention');

    // Eve (watcher, not mentioned) should receive comment_created
    const eveFeedRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { cookie: eve.cookie },
    });
    const eveFeed = (await eveFeedRes.json()).data;
    assert.equal(eveFeed.items.length, 1);
    assert.equal(eveFeed.items[0].type, 'comment_created');
  });

  // FR-N3: Background reminder & overdue jobs with idempotent deduplication
  test('NT-3: Due soon and overdue reminders with idempotent deduplication', async () => {
    const frank = await createAuthUser('frank_nt3@teamboard.local', 'Frank');
    const grace = await createAuthUser('grace_nt3@teamboard.local', 'Grace');

    // Create workspace and project
    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: frank.cookie,
        'X-CSRF-Token': frank.csrfToken,
      },
      body: JSON.stringify({ name: 'Frank WS' }),
    });
    const ws = (await wsRes.json()).data;

    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(ws.id, grace.user.id);

    const projRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: frank.cookie,
        'X-CSRF-Token': frank.csrfToken,
      },
      body: JSON.stringify({ name: 'Project 3', visibility: 'workspace' }),
    });
    const proj = (await projRes.json()).data;

    const boardsRes = await fetch(`${baseUrl}/api/projects/${proj.id}/boards`, {
      headers: { cookie: frank.cookie },
    });
    const boards = (await boardsRes.json()).data;
    const boardDetailRes = await fetch(`${baseUrl}/api/boards/${boards[0].id}`, {
      headers: { cookie: frank.cookie },
    });
    const boardDetail = (await boardDetailRes.json()).data;
    const firstCol = boardDetail.columns[0];

    // Create task due tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const dueSoonTaskRes = await fetch(`${baseUrl}/api/columns/${firstCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: frank.cookie,
        'X-CSRF-Token': frank.csrfToken,
      },
      body: JSON.stringify({
        title: 'Due Soon Task',
        dueDate: tomorrowStr,
      }),
    });
    const dueSoonTask = (await dueSoonTaskRes.json()).data;

    // Create overdue task (due yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const overdueTaskRes = await fetch(`${baseUrl}/api/columns/${firstCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: frank.cookie,
        'X-CSRF-Token': frank.csrfToken,
      },
      body: JSON.stringify({
        title: 'Overdue Task',
        dueDate: yesterdayStr,
      }),
    });
    const overdueTask = (await overdueTaskRes.json()).data;

    // Assign Grace to both tasks
    await fetch(`${baseUrl}/api/tasks/${dueSoonTask.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: frank.cookie,
        'X-CSRF-Token': frank.csrfToken,
      },
      body: JSON.stringify({ userIds: [grace.user.id] }),
    });
    await fetch(`${baseUrl}/api/tasks/${overdueTask.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: frank.cookie,
        'X-CSRF-Token': frank.csrfToken,
      },
      body: JSON.stringify({ userIds: [grace.user.id] }),
    });

    // Run reminders check (Run 1)
    const check1Res = await fetch(`${baseUrl}/api/notifications/check-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: frank.cookie,
        'X-CSRF-Token': frank.csrfToken,
      },
    });
    assert.equal(check1Res.status, 200);

    // Grace should have received due soon and overdue reminders
    const feed1Res = await fetch(`${baseUrl}/api/notifications`, {
      headers: { cookie: grace.cookie },
    });
    const feed1 = (await feed1Res.json()).data;
    const hasDueSoon = feed1.items.some((i) => i.type === 'task_due_soon');
    const hasOverdue = feed1.items.some((i) => i.type === 'task_overdue');
    assert.equal(hasDueSoon, true);
    assert.equal(hasOverdue, true);

    const countBefore = feed1.items.length;

    // Run reminders check (Run 2 - Idempotency test)
    const check2Res = await fetch(`${baseUrl}/api/notifications/check-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: frank.cookie,
        'X-CSRF-Token': frank.csrfToken,
      },
    });
    const check2Data = await check2Res.json();
    assert.equal(check2Data.data.dueSoonCount, 0);
    assert.equal(check2Data.data.overdueCount, 0);

    // Count must not increase
    const feed2Res = await fetch(`${baseUrl}/api/notifications`, {
      headers: { cookie: grace.cookie },
    });
    const feed2 = (await feed2Res.json()).data;
    assert.equal(feed2.items.length, countBefore);
  });

  // FR-N4: User preferences suppression
  test('NT-4: User preferences suppress notifications (inApp: false and mentionsOnly: true)', async () => {
    // User with inApp disabled
    const quietUser = await createAuthUser('quiet@teamboard.local', 'Quiet', { inApp: false });
    // User with mentionsOnly enabled
    const mentionOnlyUser = await createAuthUser('mention_only@teamboard.local', 'MentionOnly', {
      mentionsOnly: true,
    });
    const lead = await createAuthUser('lead_nt4@teamboard.local', 'Lead');

    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: lead.cookie,
        'X-CSRF-Token': lead.csrfToken,
      },
      body: JSON.stringify({ name: 'Prefs WS' }),
    });
    const ws = (await wsRes.json()).data;

    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
             (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(ws.id, quietUser.user.id, ws.id, mentionOnlyUser.user.id);

    const projRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: lead.cookie,
        'X-CSRF-Token': lead.csrfToken,
      },
      body: JSON.stringify({ name: 'Prefs Project', visibility: 'workspace' }),
    });
    const proj = (await projRes.json()).data;

    const boardsRes = await fetch(`${baseUrl}/api/projects/${proj.id}/boards`, {
      headers: { cookie: lead.cookie },
    });
    const boards = (await boardsRes.json()).data;
    const boardDetailRes = await fetch(`${baseUrl}/api/boards/${boards[0].id}`, {
      headers: { cookie: lead.cookie },
    });
    const boardDetail = (await boardDetailRes.json()).data;
    const firstCol = boardDetail.columns[0];

    const taskRes = await fetch(`${baseUrl}/api/columns/${firstCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: lead.cookie,
        'X-CSRF-Token': lead.csrfToken,
      },
      body: JSON.stringify({ title: 'Prefs Task' }),
    });
    const task = (await taskRes.json()).data;

    // Assign both users to task
    await fetch(`${baseUrl}/api/tasks/${task.id}/assignees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: lead.cookie,
        'X-CSRF-Token': lead.csrfToken,
      },
      body: JSON.stringify({ userIds: [quietUser.user.id, mentionOnlyUser.user.id] }),
    });

    // Quiet user (inApp: false) should have 0 notifications
    const quietFeed = (
      await (await fetch(`${baseUrl}/api/notifications`, { headers: { cookie: quietUser.cookie } })).json()
    ).data;
    assert.equal(quietFeed.items.length, 0);

    // Mention-only user should NOT have received task_assigned
    const mentionOnlyFeed1 = (
      await (
        await fetch(`${baseUrl}/api/notifications`, { headers: { cookie: mentionOnlyUser.cookie } })
      ).json()
    ).data;
    assert.equal(mentionOnlyFeed1.items.length, 0);

    // Now mention mentionOnlyUser in comment
    await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: lead.cookie,
        'X-CSRF-Token': lead.csrfToken,
      },
      body: JSON.stringify({
        body: 'Pinging @MentionOnly',
        mentions: [mentionOnlyUser.user.id],
      }),
    });

    // Mention-only user SHOULD receive comment_mention!
    const mentionOnlyFeed2 = (
      await (
        await fetch(`${baseUrl}/api/notifications`, { headers: { cookie: mentionOnlyUser.cookie } })
      ).json()
    ).data;
    assert.equal(mentionOnlyFeed2.items.length, 1);
    assert.equal(mentionOnlyFeed2.items[0].type, 'comment_mention');
  });

  // Read, Read-all, Unread-count, and Dismiss (DELETE)
  test('NT-5: Unread count, mark read, mark all read, and dismiss', async () => {
    const user = await createAuthUser('user_nt5@teamboard.local', 'UserNT5');
    const other = await createAuthUser('other_nt5@teamboard.local', 'OtherNT5');

    // Create 3 manual notifications for user
    const n1 = db.prepare(`
      INSERT INTO notifications (id, user_id, actor_id, type, title, body, created_at)
      VALUES (?, ?, ?, 'task_assigned', 'Task 1', 'Assigned 1', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      RETURNING id
    `).get(randomUUID(), user.user.id, other.user.id);

    const n2 = db.prepare(`
      INSERT INTO notifications (id, user_id, actor_id, type, title, body, created_at)
      VALUES (?, ?, ?, 'comment_mention', 'Task 2', 'Mention 2', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      RETURNING id
    `).get(randomUUID(), user.user.id, other.user.id);

    const n3 = db.prepare(`
      INSERT INTO notifications (id, user_id, actor_id, type, title, body, created_at)
      VALUES (?, ?, ?, 'task_overdue', 'Task 3', 'Overdue 3', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      RETURNING id
    `).get(randomUUID(), user.user.id, other.user.id);

    // Check unread count
    const countRes1 = await fetch(`${baseUrl}/api/notifications/unread-count`, {
      headers: { cookie: user.cookie },
    });
    const countData1 = await countRes1.json();
    assert.equal(countData1.data.unreadCount, 3);

    // Mark single notification read
    const read1Res = await fetch(`${baseUrl}/api/notifications/${n1.id}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: user.cookie,
        'X-CSRF-Token': user.csrfToken,
      },
    });
    assert.equal(read1Res.status, 200);

    const countRes2 = await fetch(`${baseUrl}/api/notifications/unread-count`, {
      headers: { cookie: user.cookie },
    });
    const countData2 = await countRes2.json();
    assert.equal(countData2.data.unreadCount, 2);

    // IDOR check: Other user cannot mark n2 read
    const idorRes = await fetch(`${baseUrl}/api/notifications/${n2.id}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: other.cookie,
        'X-CSRF-Token': other.csrfToken,
      },
    });
    assert.equal(idorRes.status, 404);

    // Mark all as read
    const readAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: user.cookie,
        'X-CSRF-Token': user.csrfToken,
      },
    });
    assert.equal(readAllRes.status, 200);

    const countRes3 = await fetch(`${baseUrl}/api/notifications/unread-count`, {
      headers: { cookie: user.cookie },
    });
    const countData3 = await countRes3.json();
    assert.equal(countData3.data.unreadCount, 0);

    // Delete / dismiss n3
    const delRes = await fetch(`${baseUrl}/api/notifications/${n3.id}`, {
      method: 'DELETE',
      headers: {
        cookie: user.cookie,
        'X-CSRF-Token': user.csrfToken,
      },
    });
    assert.equal(delRes.status, 200);

    const feedRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { cookie: user.cookie },
    });
    const feed = (await feedRes.json()).data;
    assert.equal(feed.items.length, 2);
    assert.equal(feed.items.some((i) => i.id === n3.id), false);
  });
});
