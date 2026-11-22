import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createTestApp } from '../helpers/app.js';
import {
  isDuplicateEvent,
  isStaleVersion,
  isEcho,
} from '../../public/js/lib/socket.js';

describe('Real-Time WebSocket Infrastructure (WSK-* & SEC-W)', () => {
  let appInstance;
  let baseUrl;
  let db;

  // Helper to register, verify, and login a user, returning user data + cookie + CSRF token
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

  function connectSocket(cookie, origin = 'http://localhost') {
    return new Promise((resolve) => {
      const socket = ioClient(baseUrl, {
        extraHeaders: {
          cookie: cookie || '',
          origin,
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

  // WSK-1..3: Authentication and Origin Handshake Checks
  test('WSK-1: Connecting without session cookie fails handshake with UNAUTHORIZED', async () => {
    const result = await connectSocket(null);
    assert.ok(result.error);
    result.socket?.close();
  });

  test('WSK-2: Connecting with invalid session cookie fails handshake with UNAUTHORIZED', async () => {
    const result = await connectSocket('tb_session=invalid_token_here_123');
    assert.ok(result.error);
    result.socket?.close();
  });

  test('WSK-3a: Connecting with valid session cookie connects successfully', async () => {
    const alice = await createAuthUser('alice@teamboard.local', 'Alice');
    const socket = await connectSocket(alice.cookie);
    assert.ok(socket.connected);
    assert.equal(typeof socket.id, 'string');
    socket.close();
  });

  test('WSK-3b: Handshake origin check rejects disallowed origins', async () => {
    const bob = await createAuthUser('bob@teamboard.local', 'Bob');
    const result = await connectSocket(bob.cookie, 'https://evil-attacker.example.com');
    assert.ok(result.error);
    result.socket?.close();
  });

  // WSK-4 & WSK-5..6: Project room join authorization & Private project isolation
  test('WSK-4 & WSK-5: Project room join authorization and private project isolation', async () => {
    const owner = await createAuthUser('owner@teamboard.local', 'Owner');
    const member = await createAuthUser('member@teamboard.local', 'Member');
    const outsider = await createAuthUser('outsider@teamboard.local', 'Outsider');

    // 1. Owner creates workspace
    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: owner.cookie,
        'X-CSRF-Token': owner.csrfToken,
      },
      body: JSON.stringify({ name: 'Realtime Workspace' }),
    });
    const wsData = await wsRes.json();
    const ws = wsData.data;

    // 2. Add member to workspace
    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(ws.id, member.user.id);

    // 3. Owner creates a private project (only owner is in it initially)
    const projRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: owner.cookie,
        'X-CSRF-Token': owner.csrfToken,
      },
      body: JSON.stringify({
        name: 'Private Secrets',
        visibility: 'private',
      }),
    });
    const projData = await projRes.json();
    const project = projData.data;

    // 4. Owner socket joins project room successfully
    const ownerSocket = await connectSocket(owner.cookie);
    const joinResOwner = await new Promise((resolve) => {
      ownerSocket.emit('project:join', { projectId: project.id }, resolve);
    });
    assert.equal(joinResOwner.success, true);
    assert.ok(Array.isArray(joinResOwner.presence));
    assert.equal(joinResOwner.presence.some((u) => u.id === owner.user.id), true);

    // 5. Outsider (not in workspace) attempts project:join -> NOT_FOUND (no leak)
    const outsiderSocket = await connectSocket(outsider.cookie);
    const joinResOutsider = await new Promise((resolve) => {
      outsiderSocket.emit('project:join', { projectId: project.id }, resolve);
    });
    assert.equal(joinResOutsider.success, false);
    assert.equal(joinResOutsider.error, 'NOT_FOUND');

    // 6. Member (in workspace, but NOT in private project) attempts project:join -> FORBIDDEN (WSK-6)
    const memberSocket = await connectSocket(member.cookie);
    const joinResMember = await new Promise((resolve) => {
      memberSocket.emit('project:join', { projectId: project.id }, resolve);
    });
    assert.equal(joinResMember.success, false);
    assert.equal(joinResMember.error, 'FORBIDDEN');

    ownerSocket.close();
    memberSocket.close();
    outsiderSocket.close();
  });

  // WSK-8: Immediate disconnect on logout
  test('WSK-8: Socket is immediately disconnected when user logs out via REST', async () => {
    const charlie = await createAuthUser('charlie@teamboard.local', 'Charlie');
    const socket = await connectSocket(charlie.cookie);
    assert.ok(socket.connected);

    let disconnected = false;
    socket.on('disconnect', () => {
      disconnected = true;
    });

    // Call REST logout endpoint
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: charlie.cookie,
        'X-CSRF-Token': charlie.csrfToken,
      },
    });
    assert.equal(logoutRes.status, 204);

    // Give a short delay for socket revocation event
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(disconnected, true);
    assert.equal(socket.connected, false);
  });

  // WSK-9 & WSK-10: Events emitted after database commit & Echo suppression via originClientId
  test('WSK-9 & WSK-10: REST mutation emits broadcast event with originClientId to project room', async () => {
    const dana = await createAuthUser('dana@teamboard.local', 'Dana');

    // Create workspace
    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: dana.cookie,
        'X-CSRF-Token': dana.csrfToken,
      },
      body: JSON.stringify({ name: 'Dana Workspace' }),
    });
    const wsData = await wsRes.json();
    const ws = wsData.data;

    // Create public project
    const projRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: dana.cookie,
        'X-CSRF-Token': dana.csrfToken,
      },
      body: JSON.stringify({
        name: 'Dana Project',
        visibility: 'workspace',
      }),
    });
    const projData = await projRes.json();
    const proj = projData.data;

    // Fetch board columns
    const boardsRes = await fetch(`${baseUrl}/api/projects/${proj.id}/boards`, {
      headers: { cookie: dana.cookie },
    });
    const boardsData = await boardsRes.json();
    const boards = boardsData.data;

    const boardDetailRes = await fetch(`${baseUrl}/api/boards/${boards[0].id}`, {
      headers: { cookie: dana.cookie },
    });
    const boardDetailData = await boardDetailRes.json();
    const boardDetail = boardDetailData.data;
    const firstCol = boardDetail.columns[0];

    // Connect socket and join project room
    const socket = await connectSocket(dana.cookie);
    await new Promise((resolve) => {
      socket.emit('project:join', { projectId: proj.id }, resolve);
    });

    // Setup listener for task:created
    const eventPromise = new Promise((resolve) => {
      socket.on('task:created', (envelope) => {
        resolve(envelope);
      });
    });

    // Make REST call with X-Client-Id header
    const testClientId = 'tab-dana-client-456';
    const createRes = await fetch(`${baseUrl}/api/columns/${firstCol.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: dana.cookie,
        'X-CSRF-Token': dana.csrfToken,
        'X-Client-Id': testClientId,
      },
      body: JSON.stringify({
        title: 'Realtime Broadcast Task',
      }),
    });
    assert.equal(createRes.status, 201);
    const createdTaskData = await createRes.json();
    const createdTask = createdTaskData.data;

    // Verify received event envelope
    const envelope = await eventPromise;
    assert.ok(envelope.eventId);
    assert.equal(envelope.type, 'task:created');
    assert.equal(envelope.projectId, proj.id);
    assert.equal(envelope.workspaceId, ws.id);
    assert.equal(envelope.originClientId, testClientId);
    assert.equal(envelope.actorId, dana.user.id);
    assert.equal(envelope.data.taskId, createdTask.id);

    socket.close();
  });

  // WSK-15: Multi-tab presence deduplication
  test('WSK-15: Multi-tab presence deduplication on join and leave', async () => {
    const eva = await createAuthUser('eva@teamboard.local', 'Eva');
    const wsRes = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: eva.cookie,
        'X-CSRF-Token': eva.csrfToken,
      },
      body: JSON.stringify({ name: 'Eva WS' }),
    });
    const wsData = await wsRes.json();
    const ws = wsData.data;

    const projRes = await fetch(`${baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: eva.cookie,
        'X-CSRF-Token': eva.csrfToken,
      },
      body: JSON.stringify({
        name: 'Eva Project',
        visibility: 'workspace',
      }),
    });
    const projData = await projRes.json();
    const proj = projData.data;

    // Connect observer socket (Frank)
    const frank = await createAuthUser('frank@teamboard.local', 'Frank');
    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(ws.id, frank.user.id);

    const observer = await connectSocket(frank.cookie);
    await new Promise((resolve) => {
      observer.emit('project:join', { projectId: proj.id }, resolve);
    });

    let joinEvents = 0;
    let leaveEvents = 0;
    observer.on('presence:joined', (d) => {
      if (d.user.id === eva.user.id) joinEvents++;
    });
    observer.on('presence:left', (d) => {
      if (d.userId === eva.user.id) leaveEvents++;
    });

    // Eva opens Tab 1 and joins
    const tab1 = await connectSocket(eva.cookie);
    await new Promise((resolve) => {
      tab1.emit('project:join', { projectId: proj.id }, resolve);
    });

    // Eva opens Tab 2 and joins same project
    const tab2 = await connectSocket(eva.cookie);
    await new Promise((resolve) => {
      tab2.emit('project:join', { projectId: proj.id }, resolve);
    });

    // Wait briefly for presence broadcasts
    await new Promise((r) => setTimeout(r, 100));

    // Only ONE presence:joined should have fired for Eva across both tabs
    assert.equal(joinEvents, 1);

    // Eva closes Tab 1 (Tab 2 still open) -> NO presence:left should fire
    tab1.close();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(leaveEvents, 0);

    // Eva closes Tab 2 (last tab) -> presence:left MUST fire
    tab2.close();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(leaveEvents, 1);

    observer.close();
  });

  // Client helper unit tests: Deduplication, Version Guarding, Echo Suppression
  test('WSK-11..12 & WSK-10: Client deduplication, version guarding, and echo checks', () => {
    // 1. Echo suppression
    assert.equal(isEcho(null), false);
    assert.equal(isEcho('other-client'), false);

    // 2. LRU deduplication
    const id1 = 'evt-111';
    assert.equal(isDuplicateEvent(id1), false);
    assert.equal(isDuplicateEvent(id1), true); // second time is duplicate

    // 3. Version guarding
    const entity = 'task-999';
    assert.equal(isStaleVersion(entity, 5), false); // first seen version 5
    assert.equal(isStaleVersion(entity, 5), true);  // duplicate version 5 is stale
    assert.equal(isStaleVersion(entity, 4), true);  // older version 4 is stale
    assert.equal(isStaleVersion(entity, 6), false); // newer version 6 is accepted
  });
});
