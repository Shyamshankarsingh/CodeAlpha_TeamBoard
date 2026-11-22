import { openShortcutsDialog } from '../components/shortcuts-modal.js';
import { openSearchDialog } from '../components/search-modal.js';
import { router } from '../router.js';

let pendingChord = null;
let chordTimeout = null;

export function initGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    const isInput =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    // Escape closes modals or clears input
    if (e.key === 'Escape') {
      const closeButtons = document.querySelectorAll('.tb-modal-close');
      if (closeButtons.length > 0) {
        closeButtons[closeButtons.length - 1].click();
        return;
      }
      return;
    }

    if (isInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Chord: 'g' prefix
    if (pendingChord === 'g') {
      clearTimeout(chordTimeout);
      pendingChord = null;

      if (e.key.toLowerCase() === 'b') {
        // Switch to Board view
        const boardBtn = document.querySelector('.tb-view-btn[aria-pressed="false"]:nth-child(1)');
        if (boardBtn) {
          boardBtn.click();
        }
        return;
      }

      if (e.key.toLowerCase() === 'l') {
        // Switch to List view
        const listBtn = document.querySelector('.tb-view-btn[aria-pressed="false"]:nth-child(2)');
        if (listBtn) {
          listBtn.click();
        }
        return;
      }

      if (e.key.toLowerCase() === 'i') {
        // Open Notifications
        const bellBtn = document.querySelector('.tb-notifications-btn');
        if (bellBtn) {
          bellBtn.click();
        }
        return;
      }
    }

    // Start chord: 'g'
    if (e.key.toLowerCase() === 'g') {
      pendingChord = 'g';
      chordTimeout = setTimeout(() => {
        pendingChord = null;
      }, 1000);
      return;
    }

    // Action: '/' -> Open search dialog or focus search input
    if (e.key === '/') {
      e.preventDefault();
      const searchInput = document.querySelector('.tb-filter-search, input[type="search"]');
      if (searchInput && document.body.contains(searchInput)) {
        searchInput.focus();
        if (searchInput.select) searchInput.select();
      } else {
        openSearchDialog();
      }
      return;
    }

    // Action: 'c' -> Create task in first column or click '+ Add Task'
    if (e.key.toLowerCase() === 'c') {
      const addTaskBtn = document.querySelector('.tb-column-footer .tb-btn');
      if (addTaskBtn) {
        e.preventDefault();
        addTaskBtn.click();
      }
      return;
    }

    // Action: '?' -> Shortcuts dialog
    if (e.key === '?') {
      e.preventDefault();
      openShortcutsDialog();
      return;
    }
  });
}
