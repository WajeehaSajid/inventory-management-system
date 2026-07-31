// Shared fetch helper used by every page.
// Wraps fetch so every call:
//  - talks to the backend at API_BASE
//  - parses JSON
//  - throws a normal Error with a readable message when the API
//    returns our { error: { code, message } } shape, so callers
//    can just try/catch and show err.message to the user.

const API_BASE = 'https://inventory-management-system-omega-livid.vercel.app/api';

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

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
