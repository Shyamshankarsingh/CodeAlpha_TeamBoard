import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/app.js';

describe('Health & Security Headers Integration', () => {
  let testEnv;

  before(async () => {
    testEnv = await createTestApp();
  });

  after(async () => {
    if (testEnv) {
      await testEnv.close();
    }
  });

  test('GET /api/health returns 200 and no secrets', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: 'ok' });
    assert.equal(Object.keys(body).length, 1);
  });

  test('Security headers are present on responses', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/health`);
    assert.ok(res.headers.has('x-request-id'), 'X-Request-Id missing');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'same-origin');
    
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'Content-Security-Policy missing');
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
  });

  test('Unknown API route returns 404 envelope', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/unknown-endpoint`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error, 'Error envelope missing');
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(body.error.requestId, 'requestId missing in error');
    assert.ok(Array.isArray(body.error.details));
  });

  test('Malformed JSON returns 400 envelope', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/health`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"invalidJson": ',
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.ok(body.error.requestId);
  });

  test('Oversized body (>100KB) returns 413 envelope', async () => {
    const bigString = 'x'.repeat(105 * 1024);
    const res = await fetch(`${testEnv.baseUrl}/api/health`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: bigString }),
    });

    assert.equal(res.status, 413);
    const body = await res.json();
    assert.ok(body.error);
    assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');
    assert.ok(body.error.requestId);
  });

  test('Non-API HTML route falls back to SPA index.html', async () => {
    const res = await fetch(`${testEnv.baseUrl}/projects/123`, {
      headers: {
        Accept: 'text/html',
      },
    });

    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('<title>TeamBoard</title>'));
    assert.ok(html.includes('id="app"'));
  });
});
