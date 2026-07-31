// If already logged in, skip straight to the app.
if (localStorage.getItem('authToken')) {
  location.href = 'index.html';
}

const EYE_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_CLOSED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.innerHTML = showing ? EYE_OPEN : EYE_CLOSED;
  btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
}

function switchTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('auth-error').innerHTML = '';
}

function showAuthError(message) {
  document.getElementById('auth-error').innerHTML = `<div class="banner-error">${escapeHtml(message)}</div>`;
}

function onLoginSuccess(data) {
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('authUser', JSON.stringify(data.user));
  location.href = 'index.html';
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('auth-error').innerHTML = '';

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await api.post('/auth/login', { email, password });
    onLoginSuccess(res.data);
  } catch (err) {
    showAuthError(err.message);
  }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('auth-error').innerHTML = '';

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  try {
    const res = await api.post('/auth/register', { name, email, password });
    onLoginSuccess(res.data);
  } catch (err) {
    showAuthError(err.message);
  }
});
