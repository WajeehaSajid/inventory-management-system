const app = require('../server');

const PORT = 4997;
const BASE = `http://localhost:${PORT}/api/products`;

async function run() {
  const server = app.listen(PORT);
  // Log in as admin and auto-attach the token to every fetch call made
  // for the rest of this script (so we do not have to edit every
  // individual request below).
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


  const log = (label, res, body) => {
    console.log(`\n=== ${label} (status ${res.status}) ===`);
    console.log(JSON.stringify(body));
  };

  // 1. Search by name
  let res = await fetch(`${BASE}?search=keyboard`);
  log('Search "keyboard"', res, await res.json());

  // 2. Search by SKU
  res = await fetch(`${BASE}?search=ELEC-005`);
  log('Search SKU "ELEC-005"', res, await res.json());

  // 3. Filter by category + supplier
  res = await fetch(`${BASE}?category=1&supplier=1&pageSize=3`);
  const catFilter = await res.json();
  log('Filter category=1&supplier=1', res, { count: catFilter.data.length, pagination: catFilter.pagination });

  // 4. Filter by status = out_of_stock
  res = await fetch(`${BASE}?status=out_of_stock`);
  const oos = await res.json();
  log('Filter status=out_of_stock', res, oos.data.map(p => ({ sku: p.sku, qty: p.quantity_in_stock })));

  // 5. Filter by status = low_stock
  res = await fetch(`${BASE}?status=low_stock`);
  const low = await res.json();
  log('Filter status=low_stock', res, low.data.map(p => ({ sku: p.sku, qty: p.quantity_in_stock })));

  // 6. Pagination
  res = await fetch(`${BASE}?page=2&pageSize=5`);
  const page2 = await res.json();
  log('Pagination page=2&pageSize=5', res, page2.pagination);

  // 7. Create - duplicate SKU
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dup Test', sku: 'ELEC-001', unit_price: 100 }),
  });
  log('Create product (duplicate SKU -> 409)', res, await res.json());

  // 8. Create - negative price
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad Price', sku: 'TEST-999', unit_price: -50 }),
  });
  log('Create product (negative price -> validation error)', res, await res.json());

  // 9. Create - invalid category_id
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad Category', sku: 'TEST-998', unit_price: 100, category_id: 999 }),
  });
  log('Create product (invalid category_id -> validation error)', res, await res.json());

  // 10. Create - success
  res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Gadget', sku: 'TEST-001', unit_price: 999.99,
      quantity_in_stock: 50, category_id: 1, supplier_id: 1,
    }),
  });
  const created = await res.json();
  log('Create product (valid)', res, created);

  // 11. Update
  const newId = created.data.id;
  res = await fetch(`${BASE}/${newId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Gadget Updated', sku: 'TEST-001', unit_price: 1099.99,
      quantity_in_stock: 45, category_id: 1, supplier_id: 1,
    }),
  });
  log('Update product', res, await res.json());

  // 12. Delete
  res = await fetch(`${BASE}/${newId}`, { method: 'DELETE' });
  console.log(`\n=== Delete product ${newId} (should succeed) === status ${res.status}`);

  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
