import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp } from '../helpers/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('Phase 13: Responsive Design & UX Refinement Integration', () => {
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

  test('Root / serves SPA shell index.html with 200 and security headers', async () => {
    const res = await fetch(`${testEnv.baseUrl}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type').split(';')[0], 'text/html');
    assert.ok(res.headers.get('content-security-policy'));

    const html = await res.text();
    assert.ok(html.includes('id="app"'));
    assert.ok(html.includes('main.js'));
  });

  test('CSS design tokens and responsive breakpoints exist in stylesheets', () => {
    const tokensCss = fs.readFileSync(path.join(projectRoot, 'public/assets/css/tokens.css'), 'utf-8');
    const layoutCss = fs.readFileSync(path.join(projectRoot, 'public/assets/css/layout.css'), 'utf-8');
    const pagesCss = fs.readFileSync(path.join(projectRoot, 'public/assets/css/pages.css'), 'utf-8');

    // 1. Theme tokens
    assert.ok(tokensCss.includes('--bg: #FFFFFF'), 'Missing light theme bg');
    assert.ok(tokensCss.includes('--bg: #0F1217'), 'Missing dark theme bg');
    assert.ok(tokensCss.includes('[data-theme="dark"]'), 'Missing dark theme selector');

    // 2. Mobile & Tablet Breakpoints (375px/390px/480px, 768px, 1024px)
    assert.ok(layoutCss.includes('@media (max-width: 768px)'), 'Missing 768px mobile breakpoint');
    assert.ok(layoutCss.includes('@media (min-width: 769px) and (max-width: 1024px)'), 'Missing tablet breakpoint');

    // 3. Off-canvas drawer and backdrop classes
    assert.ok(layoutCss.includes('.tb-sidebar-backdrop'), 'Missing sidebar backdrop');
    assert.ok(layoutCss.includes('.tb-menu-toggle'), 'Missing mobile menu toggle hamburger');
    assert.ok(layoutCss.includes('transform: translateX(-100%)'), 'Missing off-canvas sidebar translation');
    assert.ok(layoutCss.includes('.tb-sidebar.is-open'), 'Missing sidebar open state');

    // 4. Kanban scroll snap on mobile (375px–390px)
    assert.ok(pagesCss.includes('scroll-snap-type: x mandatory'), 'Missing scroll-snap on columns container');
    assert.ok(pagesCss.includes('scroll-snap-align: center'), 'Missing scroll-snap-align on column');
    assert.ok(pagesCss.includes('min-width: 85vw'), 'Missing 85vw column width on mobile');

    // 5. Responsive Task Panel sheet
    assert.ok(pagesCss.includes('.tb-task-panel-dialog'), 'Missing task panel dialog class');
    assert.ok(pagesCss.includes('width: 100vw !important'), 'Missing 100vw full sheet on mobile');
  });

  test('Landing page module defines rich hero, features grid, demo window, and CTAs', () => {
    const landingJs = fs.readFileSync(path.join(projectRoot, 'public/js/pages/landing.js'), 'utf-8');

    assert.ok(landingJs.includes('tb-landing-hero'), 'Missing hero section');
    assert.ok(landingJs.includes('tb-features-grid'), 'Missing features grid');
    assert.ok(landingJs.includes('tb-demo-window'), 'Missing demo window showcase');
    assert.ok(landingJs.includes('/register'), 'Missing register CTA link');
    assert.ok(landingJs.includes('/login'), 'Missing login CTA link');
    assert.ok(landingJs.includes('themeToggle()'), 'Missing theme toggle on landing page');
  });

  test('Keyboard shortcuts module covers all shortcuts per DESIGN.md', () => {
    const shortcutsJs = fs.readFileSync(path.join(projectRoot, 'public/js/lib/shortcuts.js'), 'utf-8');
    const modalJs = fs.readFileSync(path.join(projectRoot, 'public/js/components/shortcuts-modal.js'), 'utf-8');

    // Shortcuts: /, c, ?, Esc, g+b, g+l, g+i
    assert.ok(shortcutsJs.includes("e.key === '/'"), "Missing '/' search shortcut");
    assert.ok(shortcutsJs.includes("e.key === '?'"), "Missing '?' help shortcut");
    assert.ok(shortcutsJs.includes("e.key === 'Escape'"), "Missing 'Escape' close shortcut");
    assert.ok(shortcutsJs.includes("e.key.toLowerCase() === 'c'"), "Missing 'c' create task shortcut");
    assert.ok(shortcutsJs.includes("pendingChord === 'g'"), "Missing 'g' chord navigation");

    assert.ok(modalJs.includes('tb-shortcuts-dialog-content'), 'Missing shortcuts dialog content');
    assert.ok(modalJs.includes('tb-kbd'), 'Missing kbd styling tags');
  });

  test('Accessible modal dialog implements focus trap and Escape handler', () => {
    const dialogJs = fs.readFileSync(path.join(projectRoot, 'public/js/components/dialog.js'), 'utf-8');

    assert.ok(dialogJs.includes("role: 'dialog'"), 'Missing dialog role');
    assert.ok(dialogJs.includes("'aria-modal': 'true'"), 'Missing aria-modal attribute');
    assert.ok(dialogJs.includes("e.key === 'Escape'"), 'Missing Escape close handler');
    assert.ok(dialogJs.includes("e.key === 'Tab'"), 'Missing Tab focus trap');
  });
});
