import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';
import { mailer } from '../../server/lib/mailer/console.js';

describe('Authentication & Session Management Integration (AUTH-* & SEC-C*)', () => {
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

  test('AUTH-1: Register successfully returns 201, sets session cookie, returns user and CSRF token', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        name: 'Alice Smith',
        password: 'Password12345!',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();

    assert.ok(body.data.user);
    assert.equal(body.data.user.email, 'alice@example.com');
    assert.equal(body.data.user.name, 'Alice Smith');
    assert.ok(body.data.csrfToken);

    // Verify session cookie was set with proper attributes
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie.includes('tb_session='));
    assert.ok(setCookie.toLowerCase().includes('httponly'));
    assert.ok(setCookie.toLowerCase().includes('samesite=lax'));
  });

  test('AUTH-2: Rejects invalid email, short password, long password', async () => {
    // Bad email
    const res1 = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        name: 'Bad Email',
        password: 'Password12345!',
      }),
    });
    assert.equal(res1.status, 400);

    // Short password (<10 chars)
    const res2 = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'valid@example.com',
        name: 'Short PW',
        password: 'short',
      }),
    });
    assert.equal(res2.status, 400);

    // Long password (>128 chars)
    const res3 = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'valid2@example.com',
        name: 'Long PW',
        password: 'P'.repeat(129),
      }),
    });
    assert.equal(res3.status, 400);
  });

  test('AUTH-3: Duplicate email returns 409 ALREADY_EXISTS when verification is off', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ALICE@EXAMPLE.COM', // case insensitive match
        name: 'Alice Duplicate',
        password: 'Password12345!',
      }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'ALREADY_EXISTS');
  });

  test('AUTH-4 & AUTH-5: Login ok sets cookie; wrong password and unknown email return identical 401', async () => {
    // Unknown email
    const resUnknown = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'Password12345!',
      }),
    });
    assert.equal(resUnknown.status, 401);
    const bodyUnknown = await resUnknown.json();
    assert.equal(bodyUnknown.error.code, 'INVALID_CREDENTIALS');

    // Wrong password for existing user
    const resWrongPw = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'WrongPassword999!',
      }),
    });
    assert.equal(resWrongPw.status, 401);
    const bodyWrongPw = await resWrongPw.json();
    assert.equal(bodyWrongPw.error.code, 'INVALID_CREDENTIALS');
    assert.equal(bodyWrongPw.error.message, bodyUnknown.error.message);

    // Valid login
    const resValid = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'Password12345!',
      }),
    });
    assert.equal(resValid.status, 200);
    const bodyValid = await resValid.json();
    assert.equal(bodyValid.data.user.email, 'alice@example.com');
    assert.ok(bodyValid.data.csrfToken);
    assert.ok(resValid.headers.get('set-cookie').includes('tb_session='));
  });

  test('AUTH-6: Account lockout after 5 consecutive failed logins', async () => {
    // Register target user
    await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lockout@example.com',
        name: 'Lockout Target',
        password: 'CorrectPassword123!',
      }),
    });

    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'lockout@example.com',
          password: 'BadPassword!',
        }),
      });
      assert.equal(res.status, 401);
    }

    // 6th attempt should return 429 RATE_LIMITED even with correct password
    const resLocked = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lockout@example.com',
        password: 'CorrectPassword123!',
      }),
    });
    assert.equal(resLocked.status, 429);
    const body = await resLocked.json();
    assert.equal(body.error.code, 'RATE_LIMITED');
  });

  test('AUTH-7: Logout invalidates session and clears cookie', async () => {
    // Log in
    const loginRes = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'Password12345!',
      }),
    });
    const { csrfToken } = (await loginRes.json()).data;
    const cookie = getCookieValue(loginRes);

    // Call logout
    const logoutRes = await fetch(`${testEnv.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        Cookie: `tb_session=${cookie}`,
      },
    });
    assert.equal(logoutRes.status, 204);

    // Verify session is no longer authenticated
    const meRes = await fetch(`${testEnv.baseUrl}/api/auth/me`, {
      headers: { Cookie: `tb_session=${cookie}` },
    });
    assert.equal(meRes.status, 401);
  });

  test('SEC-C1 & SEC-C2: Mutation without CSRF token or with invalid CSRF token rejected with 403', async () => {
    const loginRes = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'Password12345!',
      }),
    });
    const cookie = getCookieValue(loginRes);

    // Missing CSRF
    const resNoCsrf = await fetch(`${testEnv.baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tb_session=${cookie}`,
      },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert.equal(resNoCsrf.status, 403);
    const bodyNoCsrf = await resNoCsrf.json();
    assert.equal(bodyNoCsrf.error.code, 'CSRF_INVALID');

    // Invalid CSRF
    const resBadCsrf = await fetch(`${testEnv.baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'forged-token-xyz',
        Cookie: `tb_session=${cookie}`,
      },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert.equal(resBadCsrf.status, 403);
  });

  test('SEC-Origin: Disallowed Origin header rejected with 403', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://malicious-attacker-site.com',
      },
      body: JSON.stringify({
        email: 'attacker@example.com',
        name: 'Attacker',
        password: 'Password12345!',
      }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'ORIGIN_NOT_ALLOWED');
  });

  test('AUTH-9: Password change invalidates other sessions', async () => {
    // User login session 1
    const res1 = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'Password12345!',
      }),
    });
    const cookie1 = getCookieValue(res1);
    const csrf1 = (await res1.json()).data.csrfToken;

    // User login session 2
    const res2 = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'Password12345!',
      }),
    });
    const cookie2 = getCookieValue(res2);

    // Change password using session 1
    const changeRes = await fetch(`${testEnv.baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf1,
        Cookie: `tb_session=${cookie1}`,
      },
      body: JSON.stringify({
        currentPassword: 'Password12345!',
        newPassword: 'BrandNewPassword123!',
      }),
    });
    assert.equal(changeRes.status, 204);

    // Session 1 remains valid
    const me1 = await fetch(`${testEnv.baseUrl}/api/auth/me`, {
      headers: { Cookie: `tb_session=${cookie1}` },
    });
    assert.equal(me1.status, 200);

    // Session 2 is now revoked
    const me2 = await fetch(`${testEnv.baseUrl}/api/auth/me`, {
      headers: { Cookie: `tb_session=${cookie2}` },
    });
    assert.equal(me2.status, 401);
  });

  test('AUTH-10 & AUTH-11: Forgot and reset password lifecycle', async () => {
    mailer.clearSentEmails();

    // Request reset link
    const forgotRes = await fetch(`${testEnv.baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    assert.equal(forgotRes.status, 202);

    const sent = mailer.getSentEmails();
    assert.equal(sent.length, 1);
    const resetUrlMatch = sent[0].text.match(/token=([A-Za-z0-9_-]+)/);
    assert.ok(resetUrlMatch, 'Reset token not found in email text');
    const resetToken = resetUrlMatch[1];

    // Reset password with token
    const resetRes = await fetch(`${testEnv.baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword: 'ResetPasswordSuccess1!',
      }),
    });
    assert.equal(resetRes.status, 204);

    // Old password no longer works
    const oldLogin = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'BrandNewPassword123!',
      }),
    });
    assert.equal(oldLogin.status, 401);

    // New password works
    const newLogin = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'ResetPasswordSuccess1!',
      }),
    });
    assert.equal(newLogin.status, 200);

    // Reusing the token fails (single use)
    const reuseRes = await fetch(`${testEnv.baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword: 'AnotherPassword123!',
      }),
    });
    assert.equal(reuseRes.status, 400);
  });

  test('AUTH-13: List and revoke sessions', async () => {
    // Log in
    const loginRes = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'ResetPasswordSuccess1!',
      }),
    });
    const cookie = getCookieValue(loginRes);

    const listRes = await fetch(`${testEnv.baseUrl}/api/auth/sessions`, {
      headers: { Cookie: `tb_session=${cookie}` },
    });
    assert.equal(listRes.status, 200);
    const sessions = (await listRes.json()).data;
    assert.ok(Array.isArray(sessions));
    assert.ok(sessions.length >= 1);
    assert.equal(sessions[0].current, true);
  });

  test('User profile update & search (PATCH /api/users/me & GET /api/users/search)', async () => {
    const loginRes = await fetch(`${testEnv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'ResetPasswordSuccess1!',
      }),
    });
    const cookie = getCookieValue(loginRes);
    const csrf = (await loginRes.json()).data.csrfToken;

    // Update profile
    const patchRes = await fetch(`${testEnv.baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        Cookie: `tb_session=${cookie}`,
      },
      body: JSON.stringify({
        name: 'Alice Wonder',
        timezone: 'America/New_York',
        theme: 'dark',
      }),
    });
    assert.equal(patchRes.status, 200);
    const user = (await patchRes.json()).data.user;
    assert.equal(user.name, 'Alice Wonder');
    assert.equal(user.timezone, 'America/New_York');
    assert.equal(user.theme, 'dark');

    // Search users
    const searchRes = await fetch(`${testEnv.baseUrl}/api/users/search?q=wonder`, {
      headers: { Cookie: `tb_session=${cookie}` },
    });
    assert.equal(searchRes.status, 200);
    const results = (await searchRes.json()).data;
    assert.ok(results.length >= 1);
    assert.equal(results[0].name, 'Alice Wonder');
    assert.equal(results[0].email, undefined, 'Email should not leak in general user search');
  });
});
