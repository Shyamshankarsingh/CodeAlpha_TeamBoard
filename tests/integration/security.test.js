import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp } from '../helpers/app.js';
import { workspacesRepo } from '../../server/modules/workspaces/repo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('Phase 12: Security Hardening & Comprehensive Testing (SEC-*)', () => {
  let testEnv;
  let userA, userB, userViewer;
  let wsA, wsB;
  let projA, projB, privateProjA;
  let boardA, colA;
  let taskA;

  before(async () => {
    testEnv = await createTestApp({
      REQUIRE_EMAIL_VERIFICATION: 'false',
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
        body: JSON.stringify({ email, name, password: 'Password123!' }),
      });
      const data = await res.json();
      return {
        user: data.data.user,
        csrfToken: data.data.csrfToken,
        cookie: getCookieValue(res),
      };
    }

    userA = await registerUser('usera@sec.test', 'User A');
    userB = await registerUser('userb@sec.test', 'User B');
    userViewer = await registerUser('userviewer@sec.test', 'User Viewer');

    // Workspace A (owned by User A)
    const wsARes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': userA.csrfToken,
        Cookie: `tb_session=${userA.cookie}`,
      },
      body: JSON.stringify({ name: 'Workspace A' }),
    });
    wsA = (await wsARes.json()).data;

    // Add userViewer to Workspace A as viewer
    workspacesRepo.addMember({
      workspaceId: wsA.id,
      userId: userViewer.user.id,
      role: 'viewer',
    });

    // Workspace B (owned by User B)
    const wsBRes = await fetch(`${testEnv.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': userB.csrfToken,
        Cookie: `tb_session=${userB.cookie}`,
      },
      body: JSON.stringify({ name: 'Workspace B' }),
    });
    wsB = (await wsBRes.json()).data;

    // Project A in Workspace A (workspace visibility)
    const projARes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsA.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': userA.csrfToken,
        Cookie: `tb_session=${userA.cookie}`,
      },
      body: JSON.stringify({ name: 'Project A', visibility: 'workspace' }),
    });
    projA = (await projARes.json()).data;

    // Private Project in Workspace A (only userA is member)
    const privateProjRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsA.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': userA.csrfToken,
        Cookie: `tb_session=${userA.cookie}`,
      },
      body: JSON.stringify({ name: 'Private Project A', visibility: 'private' }),
    });
    privateProjA = (await privateProjRes.json()).data;

    // Project B in Workspace B
    const projBRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsB.id}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': userB.csrfToken,
        Cookie: `tb_session=${userB.cookie}`,
      },
      body: JSON.stringify({ name: 'Project B', visibility: 'workspace' }),
    });
    projB = (await projBRes.json()).data;

    // Get boards for Project A
    const boardsRes = await fetch(`${testEnv.baseUrl}/api/projects/${projA.id}/boards`, {
      headers: { Cookie: `tb_session=${userA.cookie}` },
    });
    const boards = (await boardsRes.json()).data;
    boardA = boards[0];

    const boardDetailRes = await fetch(`${testEnv.baseUrl}/api/boards/${boardA.id}`, {
      headers: { Cookie: `tb_session=${userA.cookie}` },
    });
    const boardDetail = (await boardDetailRes.json()).data;
    colA = boardDetail.columns[0];

    // Create Task A in Project A
    const taskRes = await fetch(`${testEnv.baseUrl}/api/columns/${colA.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': userA.csrfToken,
        Cookie: `tb_session=${userA.cookie}`,
      },
      body: JSON.stringify({ title: 'Task in Project A', priority: 'medium' }),
    });
    taskA = (await taskRes.json()).data;
  });

  after(async () => {
    if (testEnv) {
      await testEnv.close();
    }
  });

  // =========================================================================
  // 1. SEC-C1..C5: CSRF, Origin Check & Content-Type Enforcement
  // =========================================================================
  describe('SEC-C1..C5: Mutation Protections (CSRF, Origin, Content-Type)', () => {
    test('SEC-C1: Mutation rejects missing X-CSRF-Token header with 403', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/columns/${colA.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `tb_session=${userA.cookie}`,
        },
        body: JSON.stringify({ title: 'CSRF missing task' }),
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error.code, 'CSRF_INVALID');
    });

    test('SEC-C2: Mutation rejects invalid X-CSRF-Token with 403', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/columns/${colA.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-csrf-token-12345',
          Cookie: `tb_session=${userA.cookie}`,
        },
        body: JSON.stringify({ title: 'CSRF invalid task' }),
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error.code, 'CSRF_INVALID');
    });

    test('SEC-C3: Mutation rejects untrusted Origin with 403', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/columns/${colA.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userA.csrfToken,
          Origin: 'http://malicious-attacker.com',
          Cookie: `tb_session=${userA.cookie}`,
        },
        body: JSON.stringify({ title: 'Untrusted Origin task' }),
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error.code, 'ORIGIN_NOT_ALLOWED');
    });

    test('SEC-C4: Mutation with body rejects non-JSON Content-Type with 415', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/columns/${colA.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'X-CSRF-Token': userA.csrfToken,
          Cookie: `tb_session=${userA.cookie}`,
        },
        body: 'title=AttackTask',
      });
      assert.equal(res.status, 415);
      const data = await res.json();
      assert.equal(data.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('SEC-C5: Safe read methods (GET) do not require CSRF token or Origin check', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${taskA.id}`, {
        method: 'GET',
        headers: {
          Cookie: `tb_session=${userA.cookie}`,
        },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.id, taskA.id);
    });
  });

  // =========================================================================
  // 2. SEC-I: Complete IDOR Sweep Across All Endpoints
  // =========================================================================
  describe('SEC-I: IDOR Attack & Information Leakage Prevention (404, not 403)', () => {
    test('User B cannot read Workspace A settings or members (404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsA.id}`, {
        headers: { Cookie: `tb_session=${userB.cookie}` },
      });
      assert.equal(res.status, 404);

      const membersRes = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsA.id}/members`, {
        headers: { Cookie: `tb_session=${userB.cookie}` },
      });
      assert.equal(membersRes.status, 404);
    });

    test('User B cannot mutate Workspace A (404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsA.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userB.csrfToken,
          Cookie: `tb_session=${userB.cookie}`,
        },
        body: JSON.stringify({ name: 'Hacked Workspace A', expectedVersion: wsA.version }),
      });
      assert.equal(res.status, 404);
    });

    test('User B cannot read Project A (404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/projects/${projA.id}`, {
        headers: { Cookie: `tb_session=${userB.cookie}` },
      });
      assert.equal(res.status, 404);
    });

    test('User B cannot read Board A (404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/boards/${boardA.id}`, {
        headers: { Cookie: `tb_session=${userB.cookie}` },
      });
      assert.equal(res.status, 404);
    });

    test('User B cannot read Column A tasks (404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/projects/${projA.id}/tasks`, {
        headers: { Cookie: `tb_session=${userB.cookie}` },
      });
      assert.equal(res.status, 404);
    });

    test('User B cannot read Task A (404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${taskA.id}`, {
        headers: { Cookie: `tb_session=${userB.cookie}` },
      });
      assert.equal(res.status, 404);
    });

    test('User B cannot modify Task A (404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${taskA.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userB.csrfToken,
          Cookie: `tb_session=${userB.cookie}`,
        },
        body: JSON.stringify({ title: 'Hacked Title', expectedVersion: taskA.version }),
      });
      assert.equal(res.status, 404);
    });

    test('User B cannot read User A notifications (returns User B feed, not User A)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/notifications`, {
        headers: { Cookie: `tb_session=${userB.cookie}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      for (const item of data.data.items) {
        assert.equal(item.userId, userB.user.id);
      }
    });

    test('Workspace Viewer cannot access private project without project membership (404)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/projects/${privateProjA.id}`, {
        headers: { Cookie: `tb_session=${userViewer.cookie}` },
      });
      assert.equal(res.status, 404);
    });
  });

  // =========================================================================
  // 3. SEC-P: Role & Permission Matrix Enforcement
  // =========================================================================
  describe('SEC-P: Server-Enforced Role Permissions (SECURITY section 2)', () => {
    test('Viewer cannot create tasks in workspace project (403)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/columns/${colA.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userViewer.csrfToken,
          Cookie: `tb_session=${userViewer.cookie}`,
        },
        body: JSON.stringify({ title: 'Viewer Task Attempt' }),
      });
      assert.equal(res.status, 403);
    });

    test('Viewer cannot update tasks (403)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${taskA.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userViewer.csrfToken,
          Cookie: `tb_session=${userViewer.cookie}`,
        },
        body: JSON.stringify({ title: 'Viewer Edit Attempt', expectedVersion: taskA.version }),
      });
      assert.equal(res.status, 403);
    });

    test('Viewer cannot create comments (403)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${taskA.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userViewer.csrfToken,
          Cookie: `tb_session=${userViewer.cookie}`,
        },
        body: JSON.stringify({ body: 'Viewer Comment Attempt' }),
      });
      assert.equal(res.status, 403);
    });

    test('Viewer cannot invite members to workspace (403)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsA.id}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userViewer.csrfToken,
          Cookie: `tb_session=${userViewer.cookie}`,
        },
        body: JSON.stringify({ email: 'newbie@sec.test', role: 'viewer' }),
      });
      assert.equal(res.status, 403);
    });

    test('Viewer cannot create projects (403)', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/workspaces/${wsA.id}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userViewer.csrfToken,
          Cookie: `tb_session=${userViewer.cookie}`,
        },
        body: JSON.stringify({ name: 'Viewer Project' }),
      });
      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // 4. SEC-S: SQL Injection Attack Payloads
  // =========================================================================
  describe('SEC-S: SQL Injection Fuzzing on Query Parameters & Filters', () => {
    test('SQL injection payload in search filter is safely parameterized', async () => {
      const payload = "'; DROP TABLE tasks; --";
      const res = await fetch(
        `${testEnv.baseUrl}/api/projects/${projA.id}/tasks?search=${encodeURIComponent(payload)}`,
        { headers: { Cookie: `tb_session=${userA.cookie}` } }
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.tasks.length, 0);

      // Verify tasks table still exists and taskA is intact
      const checkRes = await fetch(`${testEnv.baseUrl}/api/tasks/${taskA.id}`, {
        headers: { Cookie: `tb_session=${userA.cookie}` },
      });
      assert.equal(checkRes.status, 200);
    });

    test('SQL injection in sortBy column is rejected with 400 validation error', async () => {
      const attacks = [
        'title; DROP TABLE users; --',
        'title OR 1=1',
        '(SELECT password_hash FROM users LIMIT 1)',
        'unknown_column',
      ];

      for (const atk of attacks) {
        const res = await fetch(
          `${testEnv.baseUrl}/api/projects/${projA.id}/tasks?sortBy=${encodeURIComponent(atk)}`,
          { headers: { Cookie: `tb_session=${userA.cookie}` } }
        );
        assert.equal(res.status, 400, `Expected 400 for sortBy: ${atk}`);
      }
    });

    test('SQL injection in sortDir is rejected with 400 validation error', async () => {
      const res = await fetch(
        `${testEnv.baseUrl}/api/projects/${projA.id}/tasks?sortDir=${encodeURIComponent('asc; DROP TABLE tasks')}`,
        { headers: { Cookie: `tb_session=${userA.cookie}` } }
      );
      assert.equal(res.status, 400);
    });

    test('SQL injection in UUID route params returns 400 or 404 safely', async () => {
      const badId = "' OR '1'='1";
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${encodeURIComponent(badId)}`, {
        headers: { Cookie: `tb_session=${userA.cookie}` },
      });
      assert.ok(res.status === 400 || res.status === 404);
    });
  });

  // =========================================================================
  // 5. SEC-X: Stored XSS Payload Handling
  // =========================================================================
  describe('SEC-X: Stored XSS Attack Vectors', () => {
    test('Stored XSS payload in task title is stored safely and returned verbatim', async () => {
      const xssTitle = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
      const res = await fetch(`${testEnv.baseUrl}/api/columns/${colA.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userA.csrfToken,
          Cookie: `tb_session=${userA.cookie}`,
        },
        body: JSON.stringify({
          title: xssTitle,
          description: '<svg onload=alert(document.domain)>',
        }),
      });
      assert.equal(res.status, 201);
      const created = (await res.json()).data;
      assert.equal(created.title, xssTitle);
      assert.equal(created.description, '<svg onload=alert(document.domain)>');

      // Fetch back to verify persistence
      const fetchRes = await fetch(`${testEnv.baseUrl}/api/tasks/${created.id}`, {
        headers: { Cookie: `tb_session=${userA.cookie}` },
      });
      const fetched = (await fetchRes.json()).data;
      assert.equal(fetched.title, xssTitle);
    });

    test('Stored XSS in comment content is stored safely and returned verbatim', async () => {
      const xssComment = '<iframe src="javascript:alert(1)"></iframe>';
      const res = await fetch(`${testEnv.baseUrl}/api/tasks/${taskA.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': userA.csrfToken,
          Cookie: `tb_session=${userA.cookie}`,
        },
        body: JSON.stringify({ body: xssComment }),
      });
      assert.equal(res.status, 201);
      const comment = (await res.json()).data;
      assert.equal(comment.body, xssComment);
    });
  });

  // =========================================================================
  // 6. SEC-G: Static Codebase Grep for Dangerous Frontend Sinks
  // =========================================================================
  describe('SEC-G: Static Audit of public/js/ (Zero Unsafe DOM Sinks)', () => {
    test('Zero occurrences of innerHTML, outerHTML, insertAdjacentHTML, document.write, or eval in public/js/', () => {
      const publicJsDir = path.join(projectRoot, 'public/js');

      function scanDir(dir) {
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...scanDir(fullPath));
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const jsFiles = scanDir(publicJsDir);
      assert.ok(jsFiles.length > 5, 'Expected multiple JavaScript source files in public/js');

      const dangerousPatterns = [
        { name: 'innerHTML', regex: /\.innerHTML\b/ },
        { name: 'outerHTML', regex: /\.outerHTML\b/ },
        { name: 'insertAdjacentHTML', regex: /\.insertAdjacentHTML\b/ },
        { name: 'document.write', regex: /document\.write\b/ },
        { name: 'eval', regex: /\beval\s*\(/ },
      ];

      const violations = [];

      for (const file of jsFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            return;
          }
          for (const pattern of dangerousPatterns) {
            if (pattern.regex.test(line)) {
              violations.push({
                file: path.relative(projectRoot, file),
                line: index + 1,
                sink: pattern.name,
                snippet: trimmed,
              });
            }
          }
        });
      }

      assert.deepEqual(
        violations,
        [],
        `Unsafe DOM sinks found in public/js: ${JSON.stringify(violations, null, 2)}`
      );
    });
  });

  // =========================================================================
  // 7. Security Headers Verification
  // =========================================================================
  describe('Security Headers Verification', () => {
    test('Response headers enforce strict CSP, anti-clickjacking, and sniffing protections', async () => {
      const res = await fetch(`${testEnv.baseUrl}/api/health`);
      assert.equal(res.status, 200);

      const csp = res.headers.get('content-security-policy');
      assert.ok(csp, 'Missing Content-Security-Policy header');
      assert.ok(csp.includes("default-src 'self'"), 'CSP missing default-src self');
      assert.ok(csp.includes("script-src 'self'"), 'CSP missing script-src self');
      assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP missing frame-ancestors none');

      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('referrer-policy'), 'same-origin');
    });
  });
});
