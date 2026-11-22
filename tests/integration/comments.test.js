import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';
import { events } from '../../server/lib/events.js';

describe('Task Comments & Collaboration Integration (CM-* & SEC-*)', () => {
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

  async function setupTask(owner) {
    const wsRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Comments WS' }),
    });
    const ws = (await wsRes.json()).data;

    const projRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Comments Project' }),
    });
    const project = (await projRes.json()).data;

    const boardsRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/boards`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const board = (await boardsRes.json()).data[0];

    const boardDetailRes = await fetch(`${testEnv.baseUrl}/api/boards/${board.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const col = (await boardDetailRes.json()).data.columns[0];

    const taskRes = await fetch(`${testEnv.baseUrl}/api/columns/${col.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ title: 'Task for Discussion' }),
    });
    const task = (await taskRes.json()).data;

    return { ws, project, task };
  }

  test('CM-1: Create comment, commenter auto-watches task, domain event emitted', async () => {
    const owner = await registerAndLogin('cm_owner1@example.com', 'Comment Owner 1');
    const { task } = await setupTask(owner);

    let eventPayload = null;
    const listener = (event) => {
      if (event.type === 'comment.created') {
        eventPayload = event.payload;
      }
    };
    events.on('*', listener);

    const res = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        body: 'This is the initial feedback on the design.',
      }),
    });

    assert.equal(res.status, 201);
    const comment = (await res.json()).data;
    assert.equal(comment.body, 'This is the initial feedback on the design.');
    assert.equal(comment.taskId, task.id);
    assert.equal(comment.parentId, null);

    // Verify domain event
    assert.ok(eventPayload);
    assert.equal(eventPayload.taskId, task.id);
    events.off('*', listener);

    // Verify commenter is watcher
    const getTask = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const taskData = (await getTask.json()).data;
    assert.equal(taskData.watchers.some((w) => w.id === owner.user.id), true);
  });

  test('CM-2: 1-level reply nesting allowed, 2nd-level reply rejected (FR-C1)', async () => {
    const owner = await registerAndLogin('cm_owner2@example.com', 'Comment Owner 2');
    const { task } = await setupTask(owner);

    // Root comment
    const rootRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ body: 'Root question' }),
    });
    const rootComment = (await rootRes.json()).data;

    // 1st level reply (allowed)
    const reply1Res = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        body: 'First reply to question',
        parentId: rootComment.id,
      }),
    });
    assert.equal(reply1Res.status, 201);
    const reply1 = (await reply1Res.json()).data;
    assert.equal(reply1.parentId, rootComment.id);

    // 2nd level reply (attempting to reply to a reply -> rejected with 400 INVALID_NESTING)
    const reply2Res = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        body: 'Second reply to reply (should fail)',
        parentId: reply1.id,
      }),
    });
    assert.equal(reply2Res.status, 400);
    const errData = await reply2Res.json();
    assert.equal(errData.error.code, 'INVALID_NESTING');

    // List comments returns threaded structure
    const listRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(listRes.status, 200);
    const commentsList = (await listRes.json()).data;
    assert.equal(commentsList.length, 1);
    assert.equal(commentsList[0].replies.length, 1);
    assert.equal(commentsList[0].replies[0].id, reply1.id);
  });

  test('CM-3: Edit own comment succeeds; non-author edit rejected with 403', async () => {
    const owner = await registerAndLogin('cm_owner3@example.com', 'Comment Owner 3');
    const member = await registerAndLogin('cm_member3@example.com', 'Comment Member 3');
    const { ws, task } = await setupTask(owner);

    // Add member to workspace
    testEnv.db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, 'member')
    `).run(ws.id, member.user.id);

    // Member posts comment
    const commentRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': member.csrfToken,
        Cookie: `tb_session=${member.cookie}`,
      },
      body: JSON.stringify({ body: 'Original comment text' }),
    });
    const comment = (await commentRes.json()).data;

    // Owner (non-author) attempts to edit -> rejected with 403
    const failEdit = await fetch(`${testEnv.baseUrl}/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        body: 'Owner tampering with comment',
        expectedVersion: 1,
      }),
    });
    assert.equal(failEdit.status, 403);

    // Member (author) edits own comment -> succeeds
    const okEdit = await fetch(`${testEnv.baseUrl}/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': member.csrfToken,
        Cookie: `tb_session=${member.cookie}`,
      },
      body: JSON.stringify({
        body: 'Edited comment text',
        expectedVersion: 1,
      }),
    });
    assert.equal(okEdit.status, 200);
    const edited = (await okEdit.json()).data;
    assert.equal(edited.body, 'Edited comment text');
    assert.equal(edited.version, 2);
  });

  test('CM-4: Soft delete if replies exist, hard delete otherwise', async () => {
    const owner = await registerAndLogin('cm_owner4@example.com', 'Comment Owner 4');
    const { task } = await setupTask(owner);

    // Root comment with a reply
    const rootRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ body: 'Parent to be soft-deleted' }),
    });
    const rootComment = (await rootRes.json()).data;

    const replyRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        body: 'Child reply keeping thread alive',
        parentId: rootComment.id,
      }),
    });
    const reply = (await replyRes.json()).data;

    // Delete root comment (has replies) -> soft-deleted
    const delRootRes = await fetch(`${testEnv.baseUrl}/api/comments/${rootComment.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(delRootRes.status, 200);
    const delRootData = await delRootRes.json();
    assert.equal(delRootData.data.softDeleted, true);

    // List comments shows placeholder and retains reply
    const listRes = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const list = (await listRes.json()).data;
    const parentInList = list.find((c) => c.id === rootComment.id);
    assert.ok(parentInList);
    assert.equal(parentInList.isDeleted, true);
    assert.equal(parentInList.body, '[Comment deleted]');
    assert.equal(parentInList.replies.length, 1);

    // Delete leaf reply (has no replies) -> hard-deleted
    const delReplyRes = await fetch(`${testEnv.baseUrl}/api/comments/${reply.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(delReplyRes.status, 200);
    const delReplyData = await delReplyRes.json();
    assert.equal(delReplyData.data.softDeleted, false);
  });

  test('CM-5: Mention validation and auto-watching', async () => {
    const owner = await registerAndLogin('cm_owner5@example.com', 'Comment Owner 5');
    const member = await registerAndLogin('cm_member5@example.com', 'Mentioned Member');
    const stranger = await registerAndLogin('cm_stranger5@example.com', 'Stranger');
    const { ws, task } = await setupTask(owner);

    // Add member to workspace
    testEnv.db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, 'member')
    `).run(ws.id, member.user.id);

    // Mentioning stranger rejected
    const failMention = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        body: 'Hey @stranger check this',
        mentions: [stranger.user.id],
      }),
    });
    assert.equal(failMention.status, 400);

    // Mentioning valid member succeeds
    const okMention = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        body: 'Hey @member please review',
        mentions: [member.user.id],
      }),
    });
    assert.equal(okMention.status, 201);

    // Mentioned user auto-watches task
    const getTask = await fetch(`${testEnv.baseUrl}/api/tasks/${task.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const taskData = (await getTask.json()).data;
    assert.equal(taskData.watchers.some((w) => w.id === member.user.id), true);
  });
});
