import { h } from '../lib/dom.js';
import { themeToggle } from '../components/theme-toggle.js';

export function LandingPage() {
  const hero = h(
    'section',
    { className: 'tb-landing-hero' },
    h('div', { className: 'tb-hero-badge' }, '⚡ Built for High-Performance Teams'),
    h('h1', { className: 'tb-hero-title' }, 'Organize, Track, and Deliver with TeamBoard'),
    h(
      'p',
      { className: 'tb-hero-subtitle' },
      'A lightning-fast, collaborative project management platform. Real-time Kanban boards, multi-dimensional list views, smart notifications, and zero framework bloat.'
    ),
    h(
      'div',
      { className: 'tb-hero-actions' },
      h('a', { href: '/register', className: 'tb-btn tb-btn-primary tb-btn-lg' }, 'Get Started Free →'),
      h('a', { href: '/login', className: 'tb-btn tb-btn-secondary tb-btn-lg' }, 'Sign In')
    )
  );

  const features = [
    {
      icon: '☷',
      title: 'Real-Time Kanban Boards',
      desc: 'Seamless drag-and-drop workflow with fractional indexing, custom columns, live presence avatars, and instant Socket.IO state synchronization.',
    },
    {
      icon: '☰',
      title: 'Multi-View Table & Filters',
      desc: 'Switch between visual boards and responsive list views. Filter by priority, assignee, due date, or label with URL-persisted search parameters.',
    },
    {
      icon: '💬',
      title: 'Threaded Collaboration',
      desc: 'Task comments with 1-level reply nesting, team @mentions, auto-watching notifications, and detailed activity audit trails.',
    },
    {
      icon: '🔒',
      title: 'Zero-Trust Security',
      desc: 'Centralized server authorization, Argon2id passwords, strict CSP, anti-CSRF protection, and 100% pure DOM text rendering against XSS.',
    },
  ];

  const featuresSection = h(
    'section',
    { className: 'tb-landing-features' },
    h('h2', { className: 'tb-section-title' }, 'Everything Your Team Needs to Ship Faster'),
    h(
      'div',
      { className: 'tb-features-grid' },
      ...features.map((f) =>
        h(
          'div',
          { className: 'tb-feature-card' },
          h('div', { className: 'tb-feature-icon' }, f.icon),
          h('h3', { className: 'tb-feature-title' }, f.title),
          h('p', { className: 'tb-feature-desc' }, f.desc)
        )
      )
    )
  );

  const demoMockup = h(
    'section',
    { className: 'tb-landing-demo' },
    h('h2', { className: 'tb-section-title' }, 'Experience the Interface'),
    h(
      'div',
      { className: 'tb-demo-window' },
      h(
        'div',
        { className: 'tb-demo-titlebar' },
        h('span', { className: 'tb-demo-dot red' }),
        h('span', { className: 'tb-demo-dot yellow' }),
        h('span', { className: 'tb-demo-dot green' }),
        h('span', { className: 'tb-demo-window-title' }, 'TeamBoard — Sprint Planning Board')
      ),
      h(
        'div',
        { className: 'tb-demo-content' },
        // Column 1
        h(
          'div',
          { className: 'tb-demo-col' },
          h(
            'div',
            { className: 'tb-demo-col-header' },
            h('span', { className: 'tb-demo-col-name' }, 'To Do'),
            h('span', { className: 'tb-badge' }, '2')
          ),
          h(
            'div',
            { className: 'tb-demo-card' },
            h('span', { className: 'tb-priority-badge tb-priority-urgent' }, 'Urgent'),
            h('h4', { className: 'tb-demo-card-title' }, 'Migrate database to WAL mode'),
            h('p', { className: 'tb-demo-card-sub' }, '2 subtasks completed')
          ),
          h(
            'div',
            { className: 'tb-demo-card' },
            h('span', { className: 'tb-priority-badge tb-priority-high' }, 'High'),
            h('h4', { className: 'tb-demo-card-title' }, 'Implement session rate limiting'),
            h('p', { className: 'tb-demo-card-sub' }, 'Due tomorrow')
          )
        ),
        // Column 2
        h(
          'div',
          { className: 'tb-demo-col' },
          h(
            'div',
            { className: 'tb-demo-col-header' },
            h('span', { className: 'tb-demo-col-name' }, 'In Progress'),
            h('span', { className: 'tb-badge tb-badge-category-in_progress' }, '1')
          ),
          h(
            'div',
            { className: 'tb-demo-card' },
            h('span', { className: 'tb-priority-badge tb-priority-medium' }, 'Medium'),
            h('h4', { className: 'tb-demo-card-title' }, 'Build responsive table view'),
            h('p', { className: 'tb-demo-card-sub' }, '3 assignees collaborating')
          )
        ),
        // Column 3
        h(
          'div',
          { className: 'tb-demo-col' },
          h(
            'div',
            { className: 'tb-demo-col-header' },
            h('span', { className: 'tb-demo-col-name' }, 'Done'),
            h('span', { className: 'tb-badge tb-badge-category-done' }, '4')
          ),
          h(
            'div',
            { className: 'tb-demo-card tb-demo-card-done' },
            h('span', { className: 'tb-priority-badge tb-priority-low' }, 'Low'),
            h('h4', { className: 'tb-demo-card-title' }, 'Argon2id password hashing'),
            h('p', { className: 'tb-demo-card-sub' }, 'Completed')
          )
        )
      )
    )
  );

  const ctaSection = h(
    'section',
    { className: 'tb-landing-cta' },
    h('h2', { className: 'tb-cta-title' }, 'Start Managing Projects with Focus & Speed'),
    h('p', { className: 'tb-cta-desc' }, 'Free for individuals and small teams. No credit card required.'),
    h('a', { href: '/register', className: 'tb-btn tb-btn-primary tb-btn-lg' }, 'Create Your Account')
  );

  const footer = h(
    'footer',
    { className: 'tb-landing-footer' },
    h(
      'div',
      { className: 'tb-landing-footer-inner' },
      h('div', { className: 'tb-footer-brand' }, 'TeamBoard © 2026'),
      h(
        'div',
        { className: 'tb-footer-hint' },
        'Tip: Press ',
        h('kbd', { className: 'tb-kbd' }, '?'),
        ' anytime for keyboard shortcuts'
      ),
      h(
        'div',
        { className: 'tb-footer-actions' },
        themeToggle(),
        h('a', { href: '/login', className: 'tb-btn tb-btn-ghost tb-btn-sm' }, 'Sign In'),
        h('a', { href: '/register', className: 'tb-btn tb-btn-secondary tb-btn-sm' }, 'Register')
      )
    )
  );

  return h(
    'div',
    { className: 'tb-landing-page' },
    h(
      'header',
      { className: 'tb-landing-header' },
      h(
        'div',
        { className: 'tb-landing-header-inner' },
        h('a', { href: '/', className: 'tb-logo' }, 'TeamBoard'),
        h(
          'div',
          { className: 'tb-header-actions' },
          themeToggle(),
          h('a', { href: '/login', className: 'tb-btn tb-btn-ghost' }, 'Sign In'),
          h('a', { href: '/register', className: 'tb-btn tb-btn-primary' }, 'Get Started')
        )
      )
    ),
    h('main', { className: 'tb-landing-main' }, hero, featuresSection, demoMockup, ctaSection),
    footer
  );
}
