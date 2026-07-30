// Quick manual smoke test for the categories route.
// Starts the app on a test port, fires a sequence of requests,
// prints results, then shuts down. Not a substitute for the
// proper automated test suite we'll add later.

const app = require('../server');

const PORT = 4999;
const BASE = `http://localhost:${PORT}/api/categories`;

async function run() {
  const server = app.listen(PORT);

  const log = (label, res, body) => {
    console.log(`\n=== ${label} (status ${res.status}) ===`);
    console.log(JSON.stringify(body));
  };

  // 1. List
  let res = await fetch(`${BASE}?page=1&pageSize=2`);
  log('List categories', res, await res.json());

  // 2. Get by id
  res = await fetch(`${BASE}/1`);
  log('Get category 1', res, await res.json());

  // 3. Not found
  res = await fetch(`${BASE}/999`);
  log('Get category 999 (not found)', res, await res.json());

  // 4. Create success
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Toys', description: 'Kids toys' }),
  });
  const created = await res.json();
  log('Create category (Toys)', res, created);

  // 5. Validation error
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '' }),
  });
  log('Create category (empty name -> validation error)', res, await res.json());

  // 6. Duplicate name
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Electronics' }),
  });
  log('Create category (duplicate name -> 409)', res, await res.json());

  // 7. Update
  const newId = created.data.id;
  res = await fetch(`${BASE}/${newId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Toys & Games', description: 'Updated' }),
  });
  log('Update category', res, await res.json());

  // 8. Delete blocked (category 1 = Electronics, has products)
  res = await fetch(`${BASE}/1`, { method: 'DELETE' });
  log('Delete category 1 (should be blocked, in use)', res, await res.json());

  // 9. Delete allowed (the Toys category we made, unused)
  res = await fetch(`${BASE}/${newId}`, { method: 'DELETE' });
  console.log(`\n=== Delete category ${newId} (should succeed) === status ${res.status}`);

  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
