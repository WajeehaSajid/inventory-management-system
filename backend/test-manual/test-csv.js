const app = require('../server');

const PORT = 4993;
const BASE = `http://localhost:${PORT}/api/products`;

async function login(port, email, password) {
  const res = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { data } = await res.json();
  return data.token;
}

async function run() {
  const server = app.listen(PORT);
  const log = (label, res, body) => {
    console.log(`\n=== ${label} (status ${res.status}) ===`);
    console.log(typeof body === 'string' ? body : JSON.stringify(body));
  };

  const adminToken = await login(PORT, 'admin@inventory.com', 'admin123');
  const staffToken = await login(PORT, 'staff@inventory.com', 'staff123');

  // 1. Export as CSV
  let res = await fetch(`${BASE}/export`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const csvText = await res.text();
  log('GET /export', res, csvText.split('\n').slice(0, 3).join('\n') + '\n...(truncated)');

  // 2. Staff tries to import (should be forbidden)
  const blockedForm = new FormData();
  blockedForm.append('file', new Blob(['sku,name,unit_price\nX,Y,1'], { type: 'text/csv' }), 'test.csv');
  res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: blockedForm,
  });
  log('Staff tries POST /import (should be 403)', res, await res.json());

  // 3. Admin imports a CSV: 1 new product, 1 update to existing (ELEC-001), 1 bad category, 1 bad price
  const csvContent = [
    'sku,name,description,unit_price,quantity_in_stock,category,supplier',
    'CSV-NEW-001,Imported Gadget,A test product from CSV,499.50,12,Electronics,TechSource Traders',
    'ELEC-001,Wireless Mouse (Updated via CSV),Ergonomic wireless mouse,1300.00,55,Electronics,TechSource Traders',
    'CSV-BAD-001,Bad Category Row,Should fail,100,5,NoSuchCategory,TechSource Traders',
    'CSV-BAD-002,Bad Price Row,Should fail,-50,5,,',
  ].join('\n');

  const importForm = new FormData();
  importForm.append('file', new Blob([csvContent], { type: 'text/csv' }), 'import.csv');

  res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: importForm,
  });
  const importResult = await res.json();
  log('Admin imports CSV (1 create, 1 update, 2 errors expected)', res, importResult);

  // 4. Verify the new product actually exists
  res = await fetch(`${BASE}?search=CSV-NEW-001`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const searchRes = await res.json();
  log('Verify new product was created', res, searchRes.data[0]);

  // 5. Verify the existing product was actually updated
  res = await fetch(`${BASE}?search=ELEC-001`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const updatedRes = await res.json();
  log('Verify ELEC-001 was updated (price should be 1300.00)', res, { name: updatedRes.data[0].name, unit_price: updatedRes.data[0].unit_price });

  // 6. No file uploaded
  const emptyForm = new FormData();
  res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: emptyForm,
  });
  log('Import with no file (should be 422)', res, await res.json());

  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
