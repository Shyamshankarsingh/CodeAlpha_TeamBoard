import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';
import { workspacesRepo } from '../../server/modules/workspaces/repo.js';

describe('Phase 11b Extras Integration (Search, Attachments, Dependencies, Bulk, Export)', () => {
  let testEnv;
  let owner;
  let member;
  let outsider;
  let workspace;
  let project;
  let privateProject;
  let column;
  let task1;
  let task2;
  let task3;

  before(async () => {
    testEnv = await createTestApp({
      REQUIRE_EMAIL_VERIFICATION: 'false',
    });

    owner = await registerUser('extras-owner@example.com', 'Extras Owner');
    member = await registerUser('extras-member@example.com', 'Extras Member');
    outsider = await registerUser('extras-outsider@example.com', 'Extras Outsider');

    // Create workspace
    const wsRes = await apiPost('/api/workspaces', owner, { name: 'Extras Workspace' });
    workspace = wsRes.data;

    // Add member to workspace
    workspacesRepo.addMember({
      workspaceId: workspace.id,
      userId: member.user.id,
      role: 'member',
    });

    // Create public project
    const projRes = await apiPost(`/api/workspaces/${workspace.id}/projects`, owner, {
      name: 'Alpha Project',
      visibility: 'workspace',
    });
    project = projRes.data;

    // Create private project
    const privRes = await apiPost(`/api/workspaces/${workspace.id}/projects`, owner, {
      name: 'Secret Private Project',
      visibility: 'private',
    });
    privateProject = privRes.data;

    // Get boards and columns for Alpha Project
    const boardsRes = await apiGet(`/api/projects/${project.id}/boards`, owner);
    const board = boardsRes.data[0];
    const boardDetail = (await apiGet(`/api/boards/${board.id}`, owner)).data;
    column = boardDetail.columns[0];

    // Create tasks in Alpha Project
    const t1Res = await apiPost(`/api/columns/${column.id}/tasks`, owner, {
      title: 'Fix authentication vulnerability',
      description: 'Review argon2 password hashing and brute-force lockouts',
      priority: 'high',
    });
    task1 = t1Res.data;

    const t2Res = await apiPost(`/api/columns/${column.id}/tasks`, owner, {
      title: 'Implement database backup daemon',
      description: 'Scheduled SQLite integrity checks and WAL backups',
      priority: 'medium',
    });
    task2 = t2Res.data;

    const t3Res = await apiPost(`/api/columns/${column.id}/tasks`, owner, {
      title: 'Design responsive navigation drawer',
      description: 'Mobile sidebar hamburger menu with touch swipe',
      priority: 'low',
    });
    task3 = t3Res.data;

    // Create task in private project
    const privBoardsRes = await apiGet(`/api/projects/${privateProject.id}/boards`, owner);
    const privBoard = privBoardsRes.data[0];
    const privBoardDetail = (await apiGet(`/api/boards/${privBoard.id}`, owner)).data;
    const privCol = privBoardDetail.columns[0];
    await apiPost(`/api/columns/${privCol.id}/tasks`, owner, {
      title: 'Confidential executive roadmap',
      description: 'Top secret strategy planning for next year',
      priority: 'urgent',
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

  async function registerUser(email, name) {
    const res = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password: 'Password12345!' }),
    });
    const data = await res.json();
    return {
      user: data.data.user,
      csrfToken: data.data.csrfToken,
      cookie: getCookieValue(res),
    };
  }

  async function apiGet(path, authUser) {
    const res = await fetch(`${testEnv.baseUrl}${path}`, {
      headers: {
        Cookie: `tb_session=${authUser.cookie}`,
      },
    });
    return res.json();
  }

  async function apiPost(path, authUser, body) {
    const res = await fetch(`${testEnv.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': authUser.csrfToken,
        Cookie: `tb_session=${authUser.cookie}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // --- 1. FTS5 Search Tests ---
  describe('FTS5 Global Search', () => {
    test('searches tasks by title and description matching keywords', async () => {
      const res = await apiGet(`/api/workspaces/${workspace.id}/search?q=argon2`, owner);
      assert.ok(Array.isArray(res.tasks));
      assert.equal(res.tasks.length, 1);
      assert.equal(res.tasks[0].id, task1.id);
      assert.equal(res.tasks[0].title, 'Fix authentication vulnerability');
    });

    test('prefix query matches partial terms', async () => {
      const res = await apiGet(`/api/workspaces/${workspace.id}/search?q=vulnerab`, member);
      assert.ok(res.tasks.length >= 1);
      assert.equal(res.tasks[0].id, task1.id);
    });

    test('private project tasks are hidden from non-member in search results', async () => {
      // Owner finds the confidential task
      const ownerRes = await apiGet(`/api/workspaces/${workspace.id}/search?q=confidential`, owner);
      assert.equal(ownerRes.tasks.length, 1);

      // Workspace member who is not a project member on privateProject cannot see it
      const memberRes = await apiGet(`/api/workspaces/${workspace.id}/search?q=confidential`, member);
      assert.equal(memberRes.tasks.length, 0);
    });

    test('empty or whitespace query returns empty array', async () => {
      const res = await apiGet(`/api/workspaces/${workspace.id}/search?q=  `, owner);
      assert.deepEqual(res.tasks, []);
    });
  });

  // --- 2. Attachments Tests ---
  describe('Task Attachments', () => {
    let uploadedAttachmentId;

    test('successfully uploads a valid text file with signature verification', async () => {
      const formData = new FormData();
      const fileBlob = new Blob(['Sample log attachment content for testing.'], { type: 'text/plain' });
      formData.append('file', fileBlob, 'debug.txt');

      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${task1.id}/attachments`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': owner.csrfToken,
          Cookie: `tb_session=${owner.cookie}`,
        },
        body: formData,
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.ok(json.attachment);
      assert.equal(json.attachment.fileName, 'debug.txt');
      assert.equal(json.attachment.mimeType, 'text/plain');
      uploadedAttachmentId = json.attachment.id;
    });

    test('lists attachments for a task', async () => {
      const res = await apiGet(`/api/tasks/${task1.id}/attachments`, member);
      assert.ok(Array.isArray(res.attachments));
      assert.equal(res.attachments.length, 1);
      assert.equal(res.attachments[0].id, uploadedAttachmentId);
    });

    test('downloads attachment with safe headers (Content-Disposition & nosniff)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/attachments/${uploadedAttachmentId}/download`, {
        headers: {
          Cookie: `tb_session=${member.cookie}`,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/plain');
      assert.ok(res.headers.get('content-disposition').includes('attachment; filename="debug.txt"'));
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      const text = await res.text();
      assert.equal(text, 'Sample log attachment content for testing.');
    });

    test('rejects upload with disallowed mime-type or invalid magic bytes', async () => {
      const formData = new FormData();
      const exeBlob = new Blob(['MZ\x90\x00\x03\x00\x00\x00'], { type: 'application/x-msdownload' });
      formData.append('file', exeBlob, 'malware.exe');

      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${task1.id}/attachments`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': owner.csrfToken,
          Cookie: `tb_session=${owner.cookie}`,
        },
        body: formData,
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    test('outsider cannot download attachment (returns 404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/attachments/${uploadedAttachmentId}/download`, {
        headers: {
          Cookie: `tb_session=${outsider.cookie}`,
        },
      });
      assert.equal(res.status, 404);
    });

    test('deletes attachment and cleans up file', async () => {
      const delRes = await fetch(`${testEnv.baseUrl}/api/attachments/${uploadedAttachmentId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': owner.csrfToken,
          Cookie: `tb_session=${owner.cookie}`,
        },
      });
      assert.equal(delRes.status, 204);

      // Verify list is now empty
      const listRes = await apiGet(`/api/tasks/${task1.id}/attachments`, owner);
      assert.equal(listRes.attachments.length, 0);
    });
  });

  // --- 3. Task Dependencies Tests ---
  describe('Task Dependencies', () => {
    let createdDepId;

    test('adds dependency where task2 depends on task1', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${task2.id}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': owner.csrfToken,
          Cookie: `tb_session=${owner.cookie}`,
        },
        body: JSON.stringify({ dependsOnTaskId: task1.id }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.ok(json.dependency);
      assert.equal(json.dependency.taskId, task2.id);
      assert.equal(json.dependency.dependsOnTaskId, task1.id);
      createdDepId = json.dependency.id;
    });

    test('lists blocked-by and blocks dependencies correctly', async () => {
      // task2 is blocked by task1
      const t2Deps = await apiGet(`/api/tasks/${task2.id}/dependencies`, member);
      assert.equal(t2Deps.blockedBy.length, 1);
      assert.equal(t2Deps.blockedBy[0].id, task1.id);
      assert.equal(t2Deps.blocks.length, 0);

      // task1 blocks task2
      const t1Deps = await apiGet(`/api/tasks/${task1.id}/dependencies`, member);
      assert.equal(t1Deps.blockedBy.length, 0);
      assert.equal(t1Deps.blocks.length, 1);
      assert.equal(t1Deps.blocks[0].id, task2.id);
    });

    test('rejects self-dependency', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${task1.id}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': owner.csrfToken,
          Cookie: `tb_session=${owner.cookie}`,
        },
        body: JSON.stringify({ dependsOnTaskId: task1.id }),
      });
      assert.equal(res.status, 400);
    });

    test('rejects duplicate dependency (409 Conflict)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${task2.id}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': owner.csrfToken,
          Cookie: `tb_session=${owner.cookie}`,
        },
        body: JSON.stringify({ dependsOnTaskId: task1.id }),
      });
      assert.equal(res.status, 409);
    });

    test('detects and rejects circular dependency (A -> B -> A)', async () => {
      // task2 already depends on task1 (1 blocks 2).
      // Attempting to make task1 depend on task2 would form a cycle.
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${task1.id}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': owner.csrfToken,
          Cookie: `tb_session=${owner.cookie}`,
        },
        body: JSON.stringify({ dependsOnTaskId: task2.id }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'CIRCULAR_DEPENDENCY');
    });

    test('removes dependency', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/dependencies/${createdDepId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': owner.csrfToken,
          Cookie: `tb_session=${owner.cookie}`,
        },
      });
      assert.equal(res.status, 204);

      const check = await apiGet(`/api/tasks/${task2.id}/dependencies`, owner);
      assert.equal(check.blockedBy.length, 0);
    });
  });

  // --- 4. Bulk Task Operations Tests ---
  describe('Bulk Task Actions', () => {
    test('bulk moves tasks to another column', async () => {
      const boardsRes = await apiGet(`/api/projects/${project.id}/boards`, owner);
      const boardDetail = (await apiGet(`/api/boards/${boardsRes.data[0].id}`, owner)).data;
      const targetColumn = boardDetail.columns[1];

      const res = await apiPost(`/api/projects/${project.id}/tasks/bulk`, owner, {
        taskIds: [task1.id, task2.id],
        action: 'move',
        columnId: targetColumn.id,
      });

      assert.equal(res.data.success, true);
      assert.equal(res.data.count, 2);

      // Verify task column updated
      const t1 = (await apiGet(`/api/tasks/${task1.id}`, owner)).data;
      assert.equal(t1.columnId, targetColumn.id);
    });

    test('bulk assigns tasks to member', async () => {
      const res = await apiPost(`/api/projects/${project.id}/tasks/bulk`, owner, {
        taskIds: [task1.id, task2.id],
        action: 'assign',
        assigneeIds: [member.user.id],
      });

      assert.equal(res.data.success, true);
      assert.equal(res.data.count, 2);

      const t1 = (await apiGet(`/api/tasks/${task1.id}`, owner)).data;
      assert.ok(t1.assignees.some(a => a.id === member.user.id));
    });

    test('bulk archives tasks', async () => {
      const res = await apiPost(`/api/projects/${project.id}/tasks/bulk`, owner, {
        taskIds: [task3.id],
        action: 'archive',
      });

      assert.equal(res.data.success, true);
      assert.equal(res.data.count, 1);

      const t3 = (await apiGet(`/api/tasks/${task3.id}`, owner)).data;
      assert.ok(t3.archivedAt);
    });
  });

  // --- 5. Project Export Tests ---
  describe('Project Data Export', () => {
    test('exports project tasks as JSON', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/export?format=json`, {
        headers: {
          Cookie: `tb_session=${member.cookie}`,
        },
      });

      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type').includes('application/json'));
      const json = await res.json();
      assert.ok(json.project);
      assert.equal(json.project.name, 'Alpha Project');
      assert.ok(Array.isArray(json.tasks));
      assert.ok(json.tasks.length >= 3);
    });

    test('exports project tasks as standard CSV with escaping', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/export?format=csv`, {
        headers: {
          Cookie: `tb_session=${member.cookie}`,
        },
      });

      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type').includes('text/csv'));
      assert.ok(res.headers.get('content-disposition').includes('attachment; filename="alpha-project-tasks.csv"'));

      const csv = await res.text();
      const lines = csv.split('\r\n');
      assert.ok(lines.length >= 4); // header + at least 3 tasks
      assert.equal(lines[0], 'ID,Title,Description,Column,Priority,Status,Due Date,Created At');
      assert.ok(csv.includes('Fix authentication vulnerability'));
      assert.ok(csv.includes('Implement database backup daemon'));
    });
  });
});
