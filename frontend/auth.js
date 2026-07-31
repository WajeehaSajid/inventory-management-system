// Shared authentication helpers used by every protected page.

function getCurrentUser() {
  const raw = localStorage.getItem('authUser');
  return raw ? JSON.parse(raw) : null;
}

function isAdmin() {
  return getCurrentUser()?.role === 'admin';
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
  location.href = 'login.html';
}

// Call at the top of every protected page. If there's no token at all,
// bounce to login immediately (no need to wait for an API call to fail).
// A token that exists but is expired/invalid is still caught by api.js
// on the first request and redirects the same way.
function requireAuth() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    location.href = 'login.html';
    return null;
  }
  return getCurrentUser();
}

// Renders the sidebar profile block (name, role, logout) and the
// topbar avatar now that we have a real logged-in user — this
// replaces the old "click to rename" placeholder.
function renderSidebarProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const initial = user.name?.charAt(0).toUpperCase() || '?';

  const profileEl = document.querySelector('.sidebar-profile');
  if (profileEl) {
    profileEl.innerHTML = `
      <div class="avatar">${escapeHtml(initial)}</div>
      <div class="who">
        <div class="name">${escapeHtml(user.name)}</div>
        <div class="role">${escapeHtml(user.role)}</div>
      </div>
      <button class="logout-btn" onclick="logout()" title="Log out">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
      </button>
    `;
  }

  document.querySelectorAll('.topbar-avatar').forEach((el) => {
    el.textContent = initial;
    el.title = `${user.name} (${user.role})`;
  });
}

document.addEventListener('DOMContentLoaded', renderSidebarProfile);
