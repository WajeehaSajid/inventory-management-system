const app = require('../server');

const PORT = 4994;
const BASE = `http://localhost:${PORT}/api/dashboard`;

async function run() {
  const server = app.listen(PORT);
  const log = (label, res, body) => {
    console.log(`\n=== ${label} (status ${res.status}) ===`);
    console.log(JSON.stringify(body));
  };

  // Log in as admin and auto-attach the token to every fetch call.
  const loginRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@inventory.com', password: 'admin123' }),
  });
  const { data: loginData } = await loginRes.json();
  const authToken = loginData.token;
  const rawFetch = global.fetch;
  global.fetch = (url, options = {}) => rawFetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${authToken}` },
  });

  // 1. No token at all -> should still be blocked (dashboard is protected)
  global.fetch = rawFetch;
  let res = await fetch(`${BASE}/summary`);
  log('GET /summary with NO token (should be 401)', res, await res.json());
  global.fetch = (url, options = {}) => rawFetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${authToken}` },
  });

  // 2. Summary
  res = await fetch(`${BASE}/summary`);
  log('GET /summary', res, await res.json());

  // 3. Stock trend, default 7 days
  res = await fetch(`${BASE}/stock-trend`);
  const trend = await res.json();
  log('GET /stock-trend (default 7 days)', res, { count: trend.data.length, sample: trend.data[trend.data.length - 1] });

  // 4. Stock trend, custom days
  res = await fetch(`${BASE}/stock-trend?days=3`);
  const trend3 = await res.json();
  log('GET /stock-trend?days=3', res, trend3);

  // 5. Invalid days param
  res = await fetch(`${BASE}/stock-trend?days=999`);
  log('GET /stock-trend?days=999 (should be 422, max 90)', res, await res.json());

  // 6. Category breakdown
  res = await fetch(`${BASE}/category-breakdown`);
  log('GET /category-breakdown', res, await res.json());

  // 7. Top products
  res = await fetch(`${BASE}/top-products?limit=3`);
  log('GET /top-products?limit=3', res, await res.json());

  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
