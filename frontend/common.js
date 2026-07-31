// Small shared UI helpers used by every page's script.

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Stock status badge: matches the backend's status filter thresholds
// (out_of_stock = 0, low_stock = 1-9, in_stock = 10+).
function stockBadge(qty) {
  if (qty === 0) return `<span class="badge badge-out-of-stock">Out of stock</span>`;
  if (qty < 10) return `<span class="badge badge-low-stock">Low stock</span>`;
  return `<span class="badge badge-in-stock">In stock</span>`;
}

function openModal(html) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'active-modal-backdrop';
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.body.appendChild(backdrop);
  document.addEventListener('keydown', escCloseHandler);
  enhanceSelects();
}

function escCloseHandler(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  const el = document.getElementById('active-modal-backdrop');
  if (el) el.remove();
  document.removeEventListener('keydown', escCloseHandler);
}

// -----------------------------------------------------
// Custom dropdown — progressively enhances every <select class="select">
// into a pretty pill + floating menu, while keeping the real <select>
// in the DOM (hidden) so all existing .value / 'change' listener code
// in products.js / categories.js / suppliers.js keeps working untouched.
// -----------------------------------------------------
function enhanceSelects() {
  document.querySelectorAll('select.select').forEach((select) => {
    if (select.dataset.ddEnhanced) return;
    select.dataset.ddEnhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'dd';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dd-trigger';
    trigger.innerHTML = `<span class="dd-label"></span>
      <svg class="dd-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    const menu = document.createElement('div');
    menu.className = 'dd-menu';

    function renderOptions() {
      menu.innerHTML = '';
      Array.from(select.options).forEach((opt) => {
        const item = document.createElement('div');
        item.className = 'dd-option' + (opt.value === select.value ? ' selected' : '');
        item.textContent = opt.textContent;
        item.addEventListener('click', () => {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncLabel();
          closeDropdown();
        });
        menu.appendChild(item);
      });
    }

    function syncLabel() {
      const selectedOpt = select.options[select.selectedIndex];
      trigger.querySelector('.dd-label').textContent = selectedOpt ? selectedOpt.textContent : '';
      menu.querySelectorAll('.dd-option').forEach((el, i) => {
        el.classList.toggle('selected', select.options[i] && select.options[i].value === select.value);
      });
    }

    function openDropdown() {
      document.querySelectorAll('.dd.open').forEach((el) => { if (el !== wrap) el.classList.remove('open'); });
      wrap.classList.add('open');
    }
    function closeDropdown() { wrap.classList.remove('open'); }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.contains('open') ? closeDropdown() : openDropdown();
    });

    // Re-render options whenever new <option>s get added dynamically
    // (filter dropdowns are populated after an API call finishes).
    new MutationObserver(() => { renderOptions(); syncLabel(); }).observe(select, { childList: true });

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    wrap.appendChild(select);

    renderOptions();
    syncLabel();
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dd.open').forEach((el) => el.classList.remove('open'));
  });
}

document.addEventListener('DOMContentLoaded', enhanceSelects);

// -----------------------------------------------------
// Splash / intro animation — should only play the very first
// time the app is opened in a tab, and again on an actual
// browser reload/refresh (F5) — NOT when navigating between
// pages/tabs (Products/Categories/Suppliers) via the menu,
// since those are normal link clicks, not reloads.
//
// We tell the two apart using the Navigation Timing API
// (navigation.type is 'reload' only for an actual refresh)
// combined with a sessionStorage flag that remembers whether
// the splash has already played once in this browser tab.
// -----------------------------------------------------
function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  const [navEntry] = performance.getEntriesByType('navigation');
  const isReload = navEntry ? navEntry.type === 'reload' : (performance.navigation && performance.navigation.type === 1);
  const alreadyPlayed = sessionStorage.getItem('splashPlayed') === '1';

  if (alreadyPlayed && !isReload) {
    // Normal navigation between tabs after the first load — skip it.
    splash.remove();
    return;
  }

  sessionStorage.setItem('splashPlayed', '1');

  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 650);
  }, 1700);
}

document.addEventListener('DOMContentLoaded', initSplash);

// Profile display (name, role, avatar initials) is now driven by the
// real logged-in user — see renderSidebarProfile() in auth.js.

// Builds the "< 1 2 3 ... 12 >" numbered pagination bar used on every
// list page. `pagination` is the { page, pageSize, total, totalPages }
// object the API returns; `goToPageFn` is the name of the page-level
// function to call on click (each list page defines its own goToPage).
function buildPaginationHTML(pagination, goToPageFn = 'goToPage') {
  const { page, pageSize, total, totalPages } = pagination;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const arrow = (dir, targetPage, disabled) => `
    <button class="page-btn arrow" ${disabled ? 'disabled' : ''} onclick="${goToPageFn}(${targetPage})" aria-label="${dir === 'prev' ? 'Previous page' : 'Next page'}">
      ${dir === 'prev'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>'}
    </button>`;

  // Which page numbers to show: always first, last, current, and one
  // neighbour on each side; everything else collapses into "...".
  const pagesToShow = new Set([1, totalPages, page, page - 1, page + 1]);
  let numberButtons = '';
  let lastShown = 0;
  for (let p = 1; p <= totalPages; p++) {
    if (!pagesToShow.has(p) || p < 1 || p > totalPages) continue;
    if (lastShown && p - lastShown > 1) {
      numberButtons += `<span class="page-ellipsis">…</span>`;
    }
    numberButtons += `<button class="page-btn ${p === page ? 'active' : ''}" onclick="${goToPageFn}(${p})">${p}</button>`;
    lastShown = p;
  }

  return `
    <span>Showing ${total === 0 ? 0 : start}–${end} of ${total}</span>
    <div class="pagination-controls">
      ${arrow('prev', page - 1, page <= 1)}
      ${numberButtons}
      ${arrow('next', page + 1, page >= totalPages)}
    </div>
  `;
}
