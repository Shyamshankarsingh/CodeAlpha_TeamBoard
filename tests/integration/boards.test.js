import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';
import { events } from '../../server/lib/events.js';

describe('Board & Column Management Integration (BD-* & PR-1)', () => {
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

  async function createWorkspace(userSession, name = 'Board Test WS') {
    const res = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': userSession.csrfToken,
        Cookie: `tb_session=${userSession.cookie}`,
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    return data.data;
  }

  async function createProject(userSession, wsId, name = 'Board Project') {
    const res = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': userSession.csrfToken,
        Cookie: `tb_session=${userSession.cookie}`,
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    return data.data;
  }

  test('PR-1 & BD-6: Project creation atomically creates default board and 5 default columns in position order', async () => {
    const owner = await registerAndLogin('b_owner1@example.com', 'Board Owner 1');
    const ws = await createWorkspace(owner, 'WS 1');
    const project = await createProject(owner, ws.id, 'Project Alpha');

    // Fetch boards for project
    const boardsRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/boards`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(boardsRes.status, 200);
    const boardsData = await boardsRes.json();
    assert.equal(boardsData.data.length, 1);
    const defaultBoard = boardsData.data[0];
    assert.equal(defaultBoard.name, 'Kanban Board');

    // Fetch board details with columns
    const boardDetailRes = await fetch(`${testEnv.baseUrl}/api/boards/${defaultBoard.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(boardDetailRes.status, 200);
    const detailData = await boardDetailRes.json();
    const board = detailData.data;

    assert.equal(board.columns.length, 5);
    const expectedNames = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
    const expectedCategories = ['backlog', 'todo', 'in_progress', 'review', 'done'];

    for (let i = 0; i < 5; i++) {
      assert.equal(board.columns[i].name, expectedNames[i]);
      assert.equal(board.columns[i].category, expectedCategories[i]);
      if (i > 0) {
        // Positions must be strictly ascending
        assert.ok(board.columns[i - 1].position < board.columns[i].position);
      }
    }
  });

  test('BD-1: Add, rename, and delete column', async () => {
    const owner = await registerAndLogin('b_owner2@example.com', 'Board Owner 2');
    const ws = await createWorkspace(owner, 'WS 2');
    const project = await createProject(owner, ws.id, 'Project Beta');

    const boardsRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/boards`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const boards = (await boardsRes.json()).data;
    const boardId = boards[0].id;

    // 1. Add Column
    const addColRes = await fetch(`${testEnv.baseUrl}/api/boards/${boardId}/columns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        name: 'QA Ready',
        category: 'review',
      }),
    });
    assert.equal(addColRes.status, 201);
    const col = (await addColRes.json()).data;
    assert.equal(col.name, 'QA Ready');
    assert.equal(col.category, 'review');
    assert.equal(col.version, 1);

    // 2. Rename Column
    const renameRes = await fetch(`${testEnv.baseUrl}/api/columns/${col.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        name: 'QA & Staging',
        expectedVersion: 1,
      }),
    });
    assert.equal(renameRes.status, 200);
    const renamedCol = (await renameRes.json()).data;
    assert.equal(renamedCol.name, 'QA & Staging');
    assert.equal(renamedCol.version, 2);

    // 3. Delete Column
    const delRes = await fetch(`${testEnv.baseUrl}/api/columns/${col.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(delRes.status, 200);

    // Verify column is deleted
    const verifyBoard = await fetch(`${testEnv.baseUrl}/api/boards/${boardId}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const updatedBoard = (await verifyBoard.json()).data;
    assert.equal(updatedBoard.columns.some((c) => c.id === col.id), false);
  });

  test('BD-3: Column reordering produces deterministic order across clients', async () => {
    const owner = await registerAndLogin('b_owner3@example.com', 'Board Owner 3');
    const ws = await createWorkspace(owner, 'WS 3');
    const project = await createProject(owner, ws.id, 'Project Reorder');

    const boardsRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/boards`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const boardId = (await boardsRes.json()).data[0].id;

    const boardRes = await fetch(`${testEnv.baseUrl}/api/boards/${boardId}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const columns = (await boardRes.json()).data.columns;

    // Move column 0 ('Backlog') between column 1 ('To Do') and column 2 ('In Progress')
    const firstCol = columns[0];
    const prevPos = columns[1].position;
    const nextPos = columns[2].position;

    const moveRes = await fetch(`${testEnv.baseUrl}/api/columns/${firstCol.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        prevPosition: prevPos,
        nextPosition: nextPos,
        expectedVersion: firstCol.version,
      }),
    });
    assert.equal(moveRes.status, 200);

    // Refetch board and verify order
    const updatedBoardRes = await fetch(`${testEnv.baseUrl}/api/boards/${boardId}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const reorderedCols = (await updatedBoardRes.json()).data.columns;

    assert.equal(reorderedCols[0].name, 'To Do');
    assert.equal(reorderedCols[1].name, 'Backlog');
    assert.equal(reorderedCols[2].name, 'In Progress');

    // Strict position ordering maintained
    for (let i = 0; i < reorderedCols.length - 1; i++) {
      assert.ok(reorderedCols[i].position < reorderedCols[i + 1].position);
    }
  });

  test('BD-5: Last active board deletion protection', async () => {
    const owner = await registerAndLogin('b_owner5@example.com', 'Board Owner 5');
    const ws = await createWorkspace(owner, 'WS 5');
    const project = await createProject(owner, ws.id, 'Project Last Board');

    const boardsRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/boards`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    const boardId = (await boardsRes.json()).data[0].id;

    // Attempting to delete the only board returns 400
    const failDel = await fetch(`${testEnv.baseUrl}/api/boards/${boardId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(failDel.status, 400);
    const failData = await failDel.json();
    assert.equal(failData.error.code, 'LAST_BOARD_PROTECTION');

    // Create a second board
    const createSecond = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/boards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Sprint 2 Board' }),
    });
    assert.equal(createSecond.status, 201);

    // Deleting the first board now succeeds
    const okDel = await fetch(`${testEnv.baseUrl}/api/boards/${boardId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(okDel.status, 200);
  });
});
