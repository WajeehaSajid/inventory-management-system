function fillProfile() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById('profile-name').value = user.name;
  document.getElementById('profile-email').value = user.email;
  document.getElementById('profile-role-badge').innerHTML =
    `<span class="badge ${user.role === 'admin' ? 'badge-in-stock' : 'badge-low-stock'}">${escapeHtml(user.role)}</span>`;
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('profile-error');
  errorEl.innerHTML = '';

  const name = document.getElementById('profile-name').value.trim();
  try {
    const res = await api.put('/auth/profile', { name });
    localStorage.setItem('authToken', res.data.token);
    localStorage.setItem('authUser', JSON.stringify(res.data.user));
    renderSidebarProfile();
    showToast('Profile updated');
  } catch (err) {
    errorEl.innerHTML = `<div class="banner-error">${escapeHtml(err.message)}</div>`;
  }
});

document.getElementById('password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('password-error');
  errorEl.innerHTML = '';

  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (newPassword !== confirmPassword) {
    errorEl.innerHTML = `<div class="banner-error">New password and confirmation don't match.</div>`;
    return;
  }

  try {
    await api.put('/auth/change-password', { currentPassword, newPassword });
    showToast('Password updated');
    document.getElementById('password-form').reset();
  } catch (err) {
    errorEl.innerHTML = `<div class="banner-error">${escapeHtml(err.message)}</div>`;
  }
});

function setThemeChoice(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeToggleIcon();
  updateThemePickerActive();
}

function updateThemePickerActive() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  document.querySelectorAll('.theme-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeChoice === current);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fillProfile();
  updateThemePickerActive();
  initManageUsers();
});

// -----------------------------------------------------
// Manage users — admin only. Lets an admin promote a staff account
// to admin, or move an admin back to staff.
// -----------------------------------------------------
async function initManageUsers() {
  if (!isAdmin()) return;

  const card = document.getElementById('manage-users-card');
  card.style.display = 'block';
  await loadUsers();
}

async function loadUsers() {
  const container = document.getElementById('users-table-container');
  container.innerHTML = `<div class="state-block">Loading users...</div>`;

  try {
    const res = await api.get('/auth/users');
    renderUsersTable(res.data);
  } catch (err) {
    container.innerHTML = `<div class="state-block error"><div class="state-title">Couldn't load users</div>${escapeHtml(err.message)}</div>`;
  }
}

function renderUsersTable(users) {
  const container = document.getElementById('users-table-container');
  const me = getCurrentUser();

  const rows = users.map((u) => {
    const isSelf = u.id === me.id;
    const nextRole = u.role === 'admin' ? 'staff' : 'admin';
    return `
      <tr>
        <td style="font-weight:600;">${escapeHtml(u.name)}${isSelf ? ' <span class="text-muted">(you)</span>' : ''}</td>
        <td class="text-muted">${escapeHtml(u.email)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-in-stock' : 'badge-low-stock'}">${escapeHtml(u.role)}</span></td>
        <td class="actions-cell">
          ${isSelf
            ? `<span class="text-muted" style="font-size:12.5px;">Can't change your own role</span>`
            : `<button class="btn" onclick="changeUserRole(${u.id}, '${nextRole}')">Make ${nextRole}</button>`
          }
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function changeUserRole(userId, role) {
  try {
    await api.put(`/auth/users/${userId}/role`, { role });
    showToast(`Role updated to ${role}`);
    loadUsers();
  } catch (err) {
    showToast(`Couldn't update role: ${err.message}`);
  }
}
