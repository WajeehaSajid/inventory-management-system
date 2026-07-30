const app = require('../server');

const PORT = 4998;
const BASE = `http://localhost:${PORT}/api/suppliers`;

async function run() {
  const server = app.listen(PORT);

  const log = (label, res, body) => {
    console.log(`\n=== ${label} (status ${res.status}) ===`);
    console.log(JSON.stringify(body));
  };

  // 1. List
  let res = await fetch(`${BASE}?page=1&pageSize=2`);
  log('List suppliers', res, await res.json());

  // 2. Get by id
  res = await fetch(`${BASE}/1`);
  log('Get supplier 1', res, await res.json());

  // 3. Create - invalid email
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad Supplier', contact_email: 'not-an-email' }),
  });
  log('Create supplier (invalid email -> validation error)', res, await res.json());

  // 4. Create - success
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'New Supplier Co',
      contact_email: 'hello@newsupplier.com',
      phone: '+92-300-0000000',
      address: 'Test Address',
    }),
  });
  const created = await res.json();
  log('Create supplier (valid)', res, created);

  // 5. Update
  const newId = created.data.id;
  res = await fetch(`${BASE}/${newId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'New Supplier Co Updated',
      contact_email: 'updated@newsupplier.com',
    }),
  });
  log('Update supplier', res, await res.json());

  // 6. Delete blocked (supplier 1 = TechSource, has products)
  res = await fetch(`${BASE}/1`, { method: 'DELETE' });
  log('Delete supplier 1 (should be blocked, in use)', res, await res.json());

  // 7. Delete allowed (the new unused supplier)
  res = await fetch(`${BASE}/${newId}`, { method: 'DELETE' });
  console.log(`\n=== Delete supplier ${newId} (should succeed) === status ${res.status}`);

  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
