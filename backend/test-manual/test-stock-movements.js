const app = require('../server');

const PORT = 4996;
const BASE = `http://localhost:${PORT}/api/products`;

async function run() {
  const server = app.listen(PORT);

  const log = (label, res, body) => {
    console.log(`\n=== ${label} (status ${res.status}) ===`);
    console.log(JSON.stringify(body));
  };

  // Product 6 = Power Bank, seeded quantity 60
  const productId = 6;

  // 1. Check starting quantity
  let res = await fetch(`${BASE}/${productId}`);
  let product = (await res.json()).data;
  console.log(`\nStarting quantity for product ${productId}: ${product.quantity_in_stock}`);

  // 2. Stock IN
  res = await fetch(`${BASE}/${productId}/stock-movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'IN', quantity: 20, reason: 'New shipment' }),
  });
  log('Stock IN +20', res, await res.json());

  // 3. Stock OUT (valid)
  res = await fetch(`${BASE}/${productId}/stock-movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'OUT', quantity: 15, reason: 'Customer order #123' }),
  });
  log('Stock OUT -15', res, await res.json());

  // Expected quantity now: 60 + 20 - 15 = 65
  res = await fetch(`${BASE}/${productId}`);
  product = (await res.json()).data;
  console.log(`\nQuantity after IN+20/OUT-15 (expect 65): ${product.quantity_in_stock}`);

  // 4. Stock OUT - more than available (should reject, quantity unchanged)
  res = await fetch(`${BASE}/${productId}/stock-movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'OUT', quantity: 10000, reason: 'Too much' }),
  });
  log('Stock OUT -10000 (should be rejected, insufficient stock)', res, await res.json());

  res = await fetch(`${BASE}/${productId}`);
  product = (await res.json()).data;
  console.log(`\nQuantity after rejected OUT (should still be 65): ${product.quantity_in_stock}`);

  // 5. Invalid type
  res = await fetch(`${BASE}/${productId}/stock-movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'SIDEWAYS', quantity: 5 }),
  });
  log('Invalid type "SIDEWAYS"', res, await res.json());

  // 6. Zero quantity
  res = await fetch(`${BASE}/${productId}/stock-movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'IN', quantity: 0 }),
  });
  log('Zero quantity (should be rejected)', res, await res.json());

  // 7. Non-existent product
  res = await fetch(`${BASE}/99999/stock-movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'IN', quantity: 5 }),
  });
  log('Movement on non-existent product', res, await res.json());

  // 8. History
  res = await fetch(`${BASE}/${productId}/stock-movements`);
  const history = await res.json();
  log(`Movement history for product ${productId}`, res, history.data.map(m => ({ type: m.type, quantity: m.quantity, reason: m.reason })));

  server.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
