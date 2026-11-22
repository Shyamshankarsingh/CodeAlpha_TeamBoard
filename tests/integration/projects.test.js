import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';
import { events } from '../../server/lib/events.js';

describe('Project Management Integration (PR-* & SEC-I / SEC-P)', () => {
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

  async function createWorkspace(userSession, name = 'Test Workspace') {
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

  test('PR-1: Atomic creation of project, lead membership, and activity log', async () => {
    const owner = await registerAndLogin('proj_owner1@example.com', 'Project Owner');
    const ws = await createWorkspace(owner, 'Engineering WS');

    let domainEventReceived = null;
    const listener = (event) => {
      if (event.type === 'project.created') {
        domainEventReceived = event.payload;
      }
    };
    events.on('*', listener);

    const res = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        name: 'Backend API Service',
        description: 'Core microservice architecture',
        visibility: 'workspace',
        priority: 'high',
        startDate: '2026-01-01',
        deadline: '2026-06-01',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    const project = body.data;

    assert.ok(project.id);
    assert.equal(project.name, 'Backend API Service');
    assert.equal(project.priority, 'high');
    assert.equal(project.version, 1);
    assert.equal(project.role, 'lead');
    assert.equal(project.isMember, true);

    // Verify creator is in members
    const membersRes = await fetch(`${testEnv.baseUrl}/api/projects/${project.id}/members`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(membersRes.status, 200);
    const membersData = await membersRes.json();
    assert.equal(membersData.data.length, 1);
    assert.equal(membersData.data[0].userId, owner.user.id);
    assert.equal(membersData.data[0].role, 'lead');

    // Verify domain event fired
    assert.ok(domainEventReceived);
    assert.equal(domainEventReceived.workspaceId, ws.id);
    events.off('*', listener);
  });

  test('PR-2: Visibility boundaries (workspace vs private) and 404 leak prevention', async () => {
    const owner = await registerAndLogin('vis_owner@example.com', 'Vis Owner');
    const ws = await createWorkspace(owner, 'Visibility WS');

    const member1 = await registerAndLogin('vis_member1@example.com', 'Vis Member 1');
    const member2 = await registerAndLogin('vis_member2@example.com', 'Vis Member 2');

    // Add members to workspace
    testEnv.db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, 'member'), (?, ?, 'member')
    `).run(ws.id, member1.user.id, ws.id, member2.user.id);

    // Member 1 creates a private project
    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': member1.csrfToken,
        Cookie: `tb_session=${member1.cookie}`,
      },
      body: JSON.stringify({
        name: 'Super Secret Project',
        visibility: 'private',
      }),
    });
    assert.equal(createRes.status, 201);
    const secretProj = (await createRes.json()).data;

    // 1. Project creator (member1) can access it
    const accessM1 = await fetch(`${testEnv.baseUrl}/api/projects/${secretProj.id}`, {
      headers: { Cookie: `tb_session=${member1.cookie}` },
    });
    assert.equal(accessM1.status, 200);

    // 2. Workspace Owner can access it even if not explicitly invited (ADR-021)
    const accessOwner = await fetch(`${testEnv.baseUrl}/api/projects/${secretProj.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(accessOwner.status, 200);

    // 3. Member 2 (not a member of the project) receives 404 (NOT 403, no existence leak!)
    const accessM2 = await fetch(`${testEnv.baseUrl}/api/projects/${secretProj.id}`, {
      headers: { Cookie: `tb_session=${member2.cookie}` },
    });
    assert.equal(accessM2.status, 404);
    const m2Data = await accessM2.json();
    assert.equal(m2Data.error.code, 'NOT_FOUND');

    // 4. Listing projects for Member 2 does NOT include the private project
    const listM2 = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      headers: { Cookie: `tb_session=${member2.cookie}` },
    });
    assert.equal(listM2.status, 200);
    const listM2Data = await listM2.json();
    assert.equal(listM2Data.data.some((p) => p.id === secretProj.id), false);

    // 5. Listing projects for Member 1 DOES include the private project
    const listM1 = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      headers: { Cookie: `tb_session=${member1.cookie}` },
    });
    assert.equal(listM1.status, 200);
    const listM1Data = await listM1.json();
    assert.equal(listM1Data.data.some((p) => p.id === secretProj.id), true);
  });

  test('PR-3: Optimistic locking conflict (409) on stale update', async () => {
    const owner = await registerAndLogin('opt_owner@example.com', 'Opt Owner');
    const ws = await createWorkspace(owner, 'Concurrency WS');

    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Concurrency Test' }),
    });
    const proj = (await createRes.json()).data;
    assert.equal(proj.version, 1);

    // Attempt update with wrong version
    const conflictRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        name: 'Conflicting Name',
        expectedVersion: 999,
      }),
    });
    assert.equal(conflictRes.status, 409);
    const conflictData = await conflictRes.json();
    assert.equal(conflictData.error.code, 'CONCURRENCY_CONFLICT');

    // Update with correct version
    const okRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        name: 'Updated Concurrency Name',
        expectedVersion: 1,
      }),
    });
    assert.equal(okRes.status, 200);
    const okData = await okRes.json();
    assert.equal(okData.data.name, 'Updated Concurrency Name');
    assert.equal(okData.data.version, 2);
  });

  test('PR-4: Archived projects reject settings edits and can be unarchived', async () => {
    const owner = await registerAndLogin('arch_owner@example.com', 'Arch Owner');
    const ws = await createWorkspace(owner, 'Archive WS');

    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Project to Archive' }),
    });
    const proj = (await createRes.json()).data;

    // Archive project
    const archRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    assert.equal(archRes.status, 200);
    const archivedProj = (await archRes.json()).data;
    assert.ok(archivedProj.archivedAt);
    assert.equal(archivedProj.version, 2);

    // Attempting to edit settings while archived fails with 400
    const editRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        name: 'Should Fail',
        expectedVersion: 2,
      }),
    });
    assert.equal(editRes.status, 400);
    const editData = await editRes.json();
    assert.equal(editData.error.code, 'PROJECT_ARCHIVED');

    // Unarchive project
    const unarchRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}/unarchive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    assert.equal(unarchRes.status, 200);
    const restoredProj = (await unarchRes.json()).data;
    assert.equal(restoredProj.archivedAt, null);
    assert.equal(restoredProj.version, 3);
  });

  test('PR-5: Project deletion requires exact typed name confirmation', async () => {
    const owner = await registerAndLogin('del_owner@example.com', 'Del Owner');
    const ws = await createWorkspace(owner, 'Delete WS');

    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Delete Target Project' }),
    });
    const proj = (await createRes.json()).data;

    // Wrong confirmation name
    const failRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ confirmName: 'Wrong Name' }),
    });
    assert.equal(failRes.status, 400);

    // Correct confirmation name
    const okRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ confirmName: 'Delete Target Project' }),
    });
    assert.equal(okRes.status, 200);

    // Project is gone
    const getRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(getRes.status, 404);
  });

  test('PR-6: Activity audit feed returns recorded events with actor details', async () => {
    const owner = await registerAndLogin('act_owner@example.com', 'Activity Owner');
    const ws = await createWorkspace(owner, 'Activity WS');

    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${ws.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Activity Tracked Project' }),
    });
    const proj = (await createRes.json()).data;

    // Fetch project activity
    const actRes = await fetch(`${testEnv.baseUrl}/api/projects/${proj.id}/activity`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(actRes.status, 200);
    const actData = await actRes.json();

    assert.ok(Array.isArray(actData.data));
    assert.ok(actData.data.length >= 1);
    const createdEvent = actData.data.find((a) => a.action === 'project.created');
    assert.ok(createdEvent);
    assert.equal(createdEvent.actor.id, owner.user.id);
    assert.equal(createdEvent.actor.name, 'Activity Owner');
  });
});
