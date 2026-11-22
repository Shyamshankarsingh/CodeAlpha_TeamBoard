# UI & UX Design System

**Status:** Design only.  
**Related:** [ARCHITECTURE.md](file:///e:/projectanagement/docs/ARCHITECTURE.md), [PRD.md](file:///e:/projectanagement/docs/PRD.md), [SECURITY.md](file:///e:/projectanagement/docs/SECURITY.md).

---

## 1. Visual Direction

Minimal, clean, and spacious. Monochromatic neutral foundation with an indigo accent color (`--primary`). High information density balanced by strict alignment and typography hierarchy.

---

## 2. Design Tokens (`tokens.css`)

### 2.1 Colors & Theme Switching
Tokens defined in `tokens.css` with WCAG AA compliance (4.5:1 text, 3:1 UI):

| Token | Light Value | Dark Value |
| :--- | :--- | :--- |
| `--bg` | `#FFFFFF` | `#0F1217` |
| `--surface` | `#F7F8FA` | `#171B22` |
| `--border` | `#E3E6EB` | `#2A303A` |
| `--border-strong` | `#8A93A3` | `#5B6472` |
| `--text` | `#1B1F27` | `#E8EAEE` |
| `--text-muted` | `#5B6472` | `#9AA3B2` |
| `--primary` | `#4F46E5` | `#8B93FF` |
| `--on-primary` | `#FFFFFF` | `#0F1217` |
| `--danger` | `#C62828` | `#FF8A80` |
| `--success` | `#1E7B45` | `#5FD08A` |
| `--warning` | `#8A5A00` | `#F0B24A` |

Priority indicators: Urgent (`--danger`), High (`--warning`), Medium (`--primary`), Low (`--text-muted`).

### 2.2 Typography & Spacing
- **Font Stack:** System font stack (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`).
- **Scale:** 0.75rem, 0.875rem, 1rem (base), 1.125rem, 1.25rem, 1.5rem, 1.875rem.
- **Spacing:** Base 4px scale (`--space-1`: 4px, `--space-2`: 8px, `--space-3`: 12px, `--space-4`: 16px, `--space-6`: 24px, `--space-8`: 32px, `--space-12`: 48px, `--space-16`: 64px).
- **Radii:** `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (14px).

---

## 3. Responsive Layout Strategy

- **Mobile First:** Breakpoints at 375px, 390px, 768px, 1024px, 1280px, 1440px.
- **375px - 390px (Mobile):** Slide-over navigation drawer, horizontal Kanban columns with scroll snap (85vw width per column), full-screen task sheet, single column dashboard tiles. No horizontal page scroll.
- **768px (Tablet):** Collapsed icon rail sidebar, 2.5 columns visible on board, 70vw side task sheet.
- **1024px+ (Desktop):** Full 240px sidebar, 480px-520px side task panel overlay over interactive board.

---

## 4. Accessibility & Keyboard Control

- Full WCAG 2.2 AA target.
- Roving `tabindex` and visible 2px focus rings (`--primary`).
- Keyboard shortcuts:
  - `/`: Focus search
  - `c`: Create task in active column
  - `?`: Shortcut modal
  - `g` then `b`: Navigate to Board
  - `g` then `l`: Navigate to List
  - `g` then `i`: Navigate to Inbox
  - `Esc`: Close open modal/panel
- Drag-and-drop always supported by accessible "Move to column / position" menu.
