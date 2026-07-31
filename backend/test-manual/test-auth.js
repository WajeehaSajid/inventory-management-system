const app = require('../server');

const PORT = 4995;
const BASE = `http://localhost:${PORT}`;

async function run() {
  const server = app.listen(PORT);
  const log = (label, res, body) => {
    console.log(`\n=== ${label} (status ${res.status}) ===`);
    console.log(JSON.stringify(body));
  };

  // 1. Accessing a protected route without a token
  let res = await fetch(`${BASE}/api/products`);
  log('GET /products with NO token (should be 401)', res, await res.json());

  // 2. Login as admin
  res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@inventory.com', password: 'admin123' }),
  });
  const adminLogin = await res.json();
  log('Login as admin', res, adminLogin);
  const adminToken = adminLogin.data.token;

  // 3. Login as staff
  res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff@inventory.com', password: 'staff123' }),
  });
  const staffLogin = await res.json();
  log('Login as staff', res, staffLogin);
  const staffToken = staffLogin.data.token;

  // 4. Wrong password
  res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@inventory.com', password: 'wrongpassword' }),
  });
  log('Login with wrong password (should be 401)', res, await res.json());

  // 5. Signup a new staff user
  res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'New Person', email: 'newperson@inventory.com', password: 'mypassword' }),
  });
  log('Register new user (should default to staff role)', res, await res.json());

  // 6. Access protected route WITH admin token
  res = await fetch(`${BASE}/api/products?pageSize=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const productsRes = await res.json();
  log('GET /products WITH admin token (should be 200)', res, { total: productsRes.pagination?.total });

  // 7. Staff tries to DELETE a category (should be forbidden)
  res = await fetch(`${BASE}/api/categories/1`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  log('Staff tries DELETE category (should be 403 FORBIDDEN)', res, await res.json());

  // 8. Staff CAN create a product (non-delete actions allowed)
  res = await fetch(`${BASE}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ name: 'Staff Created Item', sku: 'TEST-AUTH-001', unit_price: 100 }),
  });
  const staffCreated = await res.json();
  log('Staff creates a product (should succeed, 201)', res, staffCreated);

  // 9. Admin CAN delete that same product
  const newId = staffCreated.data.id;
  res = await fetch(`${BASE}/api/products/${newId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`\n=== Admin deletes the product (should be 204) === status ${res.status}`);

  // 10. GET /api/auth/me with a valid token
  res = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  log('GET /api/auth/me', res, await res.json());

  // 11. Garbage token
  res = await fetch(`${BASE}/api/products`, {
    headers: { Authorization: `Bearer garbage.token.here` },
  });
  log('GET /products with garbage token (should be 401)', res, await res.json());

  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
