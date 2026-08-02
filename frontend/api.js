// Shared fetch helper used by every page.
// Wraps fetch so every call:
//  - talks to the backend at API_BASE
//  - parses JSON
//  - throws a normal Error with a readable message when the API
//    returns our { error: { code, message } } shape, so callers
//    can just try/catch and show err.message to the user.

// When running locally (Docker, or a plain http.server) the backend is
// at localhost:4000. On the deployed site, it's the Vercel URL. This
// way the same file works in both places with no manual edits.
const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:4000/api'
  : 'https://inventory-management-system-omega-livid.vercel.app/api';

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('authToken');

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  // Session expired or missing — send the user back to log in.
  if (res.status === 401) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    if (!location.pathname.endsWith('login.html')) {
      location.href = 'login.html';
    }
    throw new Error('Session expired. Please log in again.');
  }

  // 204 No Content (e.g. successful DELETE) has no body to parse.
  if (res.status === 204) return null;

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message = body?.error?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }

  return body;
}

const api = {
  get: (path) => apiRequest(path),
  post: (path, data) => apiRequest(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => apiRequest(path, { method: 'PUT', body: JSON.stringify(data) }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
};
