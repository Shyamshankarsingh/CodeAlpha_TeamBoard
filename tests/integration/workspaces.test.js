import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';
import { mailer } from '../../server/lib/mailer/console.js';

describe('Workspaces & Membership Integration (WS-* & SEC-I / SEC-P)', () => {
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

  test('WS-1: Create workspace makes creator the Owner', async () => {
    const owner = await registerAndLogin('owner1@example.com', 'Workspace Owner');

    const res = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Acme Engineering' }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.name, 'Acme Engineering');
    assert.equal(body.data.role, 'owner');
    assert.ok(body.data.id);
  });

  test('WS-2 & SEC-I: Role matrix enforcement and 404 for non-members', async () => {
    const owner = await registerAndLogin('ws2_owner@example.com', 'WS2 Owner');
    const outsider = await registerAndLogin('ws2_outsider@example.com', 'Outsider');

    // Create workspace
    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Role Test Workspace' }),
    });
    const wsId = (await createRes.json()).data.id;

    // Outsider trying to view workspace -> 404 NOT_FOUND (no existence leak)
    const outsiderView = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      headers: { Cookie: `tb_session=${outsider.cookie}` },
    });
    assert.equal(outsiderView.status, 404);
    assert.equal((await outsiderView.json()).error.code, 'NOT_FOUND');

    // Outsider trying to edit workspace -> 404 NOT_FOUND
    const outsiderEdit = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': outsider.csrfToken,
        Cookie: `tb_session=${outsider.cookie}`,
      },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert.equal(outsiderEdit.status, 404);

    // Owner can edit workspace
    const ownerEdit = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Updated Workspace Name' }),
    });
    assert.equal(ownerEdit.status, 200);
    assert.equal((await ownerEdit.json()).data.name, 'Updated Workspace Name');
  });

  test('WS-3: Last owner invariant: cannot leave or be demoted', async () => {
    const owner = await registerAndLogin('ws3_owner@example.com', 'Solo Owner');

    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Solo Workspace' }),
    });
    const wsId = (await createRes.json()).data.id;

    // Attempt to leave (delete self)
    const leaveRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}/members/${owner.user.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
    });
    assert.equal(leaveRes.status, 409);
    assert.equal((await leaveRes.json()).error.code, 'LAST_OWNER');

    // Attempt to demote self to member
    const demoteRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}/members/${owner.user.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ role: 'member' }),
    });
    assert.equal(demoteRes.status, 403); // Owner cannot change own role; transfer ownership is required
  });

  test('WS-4: Invitation lifecycle: preview, acceptance, email validation, and duplicate rejection', async () => {
    mailer.clearSentEmails();
    const owner = await registerAndLogin('inv_owner@example.com', 'Invite Owner');
    const invitee = await registerAndLogin('invitee@example.com', 'Invited User');
    const wrongUser = await registerAndLogin('wrong@example.com', 'Wrong User');

    // Create workspace
    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Invitation Workspace' }),
    });
    const wsId = (await createRes.json()).data.id;

    // Send invitation to invitee
    const inviteRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        email: 'invitee@example.com',
        role: 'member',
      }),
    });
    assert.equal(inviteRes.status, 201);

    // Duplicate pending invitation returns 409
    const dupRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({
        email: 'invitee@example.com',
        role: 'viewer',
      }),
    });
    assert.equal(dupRes.status, 409);

    // Extract token from mailer
    const sent = mailer.getSentEmails();
    const tokenMatch = sent[0].text.match(/invite\/([A-Za-z0-9_-]+)/);
    assert.ok(tokenMatch, 'Invite token missing from email');
    const token = tokenMatch[1];

    // Preview invitation (unauthenticated public endpoint)
    const previewRes = await fetch(`${testEnv.baseUrl}/api/invitations/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    assert.equal(previewRes.status, 200);
    const preview = (await previewRes.json()).data;
    assert.equal(preview.workspaceName, 'Invitation Workspace');
    assert.equal(preview.email, 'invitee@example.com');
    assert.equal(preview.role, 'member');

    // Wrong user attempts to accept invitation -> 403 FORBIDDEN
    const wrongAccept = await fetch(`${testEnv.baseUrl}/api/invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': wrongUser.csrfToken,
        Cookie: `tb_session=${wrongUser.cookie}`,
      },
      body: JSON.stringify({ token }),
    });
    assert.equal(wrongAccept.status, 403);

    // Matching user accepts invitation -> 200 OK
    const acceptRes = await fetch(`${testEnv.baseUrl}/api/invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': invitee.csrfToken,
        Cookie: `tb_session=${invitee.cookie}`,
      },
      body: JSON.stringify({ token }),
    });
    assert.equal(acceptRes.status, 200);
    const acceptData = (await acceptRes.json()).data;
    assert.equal(acceptData.workspaceId, wsId);
    assert.equal(acceptData.role, 'member');

    // Now invitee can access the workspace
    const wsView = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      headers: { Cookie: `tb_session=${invitee.cookie}` },
    });
    assert.equal(wsView.status, 200);
  });

  test('WS-7: Ownership transfer: old owner becomes admin, new owner becomes owner', async () => {
    const owner = await registerAndLogin('transfer_owner@example.com', 'Original Owner');
    const member = await registerAndLogin('transfer_member@example.com', 'New Owner');

    // Create workspace
    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Transfer Workspace' }),
    });
    const wsId = (await createRes.json()).data.id;

    // Invite member and accept
    const invRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ email: 'transfer_member@example.com', role: 'member' }),
    });
    const sent = mailer.getSentEmails();
    const token = sent[sent.length - 1].text.match(/invite\/([A-Za-z0-9_-]+)/)[1];

    await fetch(`${testEnv.baseUrl}/api/invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': member.csrfToken,
        Cookie: `tb_session=${member.cookie}`,
      },
      body: JSON.stringify({ token }),
    });

    // Transfer ownership to member
    const transferRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}/transfer-ownership`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ userId: member.user.id }),
    });
    assert.equal(transferRes.status, 204);

    // Verify member is now owner
    const memberView = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      headers: { Cookie: `tb_session=${member.cookie}` },
    });
    assert.equal((await memberView.json()).data.role, 'owner');

    // Verify original owner is now admin
    const ownerView = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal((await ownerView.json()).data.role, 'admin');
  });

  test('WS-6: Delete workspace requires exact typed name confirmation', async () => {
    const owner = await registerAndLogin('delete_owner@example.com', 'Deleter');

    const createRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ name: 'Delete Me Workspace' }),
    });
    const wsId = (await createRes.json()).data.id;

    // Mismatched name -> 400
    const failRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ confirmName: 'Wrong Name' }),
    });
    assert.equal(failRes.status, 400);

    // Matching name -> 204
    const successRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': owner.csrfToken,
        Cookie: `tb_session=${owner.cookie}`,
      },
      body: JSON.stringify({ confirmName: 'Delete Me Workspace' }),
    });
    assert.equal(successRes.status, 204);

    // Workspace now returns 404
    const checkRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsId}`, {
      headers: { Cookie: `tb_session=${owner.cookie}` },
    });
    assert.equal(checkRes.status, 404);
  });
});
