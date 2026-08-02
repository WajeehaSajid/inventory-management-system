const pool = require('../db/pool');
const { app, request, loginAs, unique } = require('./helpers');

let adminToken;
let productId;

beforeAll(async () => {
  adminToken = await loginAs('admin');
  const created = await request(app).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({
    name: 'Stock Test Product', sku: `JEST-STOCK-${unique()}`, unit_price: 10, quantity_in_stock: 20,
  });
  productId = created.body.data.id;
});

afterAll(async () => {
  await request(app).delete(`/api/products/${productId}`).set('Authorization', `Bearer ${adminToken}`);
  await pool.end();
});

describe('Stock Movements', () => {
  test('IN movement increases quantity', async () => {
    const res = await request(app).post(`/api/products/${productId}/stock-movements`).set('Authorization', `Bearer ${adminToken}`).send({ type: 'IN', quantity: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data.product.quantity_in_stock).toBe(30);
  });

  test('OUT movement decreases quantity', async () => {
    const res = await request(app).post(`/api/products/${productId}/stock-movements`).set('Authorization', `Bearer ${adminToken}`).send({ type: 'OUT', quantity: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.product.quantity_in_stock).toBe(25);
  });

  test('OUT movement larger than available stock is rejected and quantity is unchanged', async () => {
    const before = await request(app).get(`/api/products/${productId}`).set('Authorization', `Bearer ${adminToken}`);
    const qtyBefore = before.body.data.quantity_in_stock;

    const res = await request(app).post(`/api/products/${productId}/stock-movements`).set('Authorization', `Bearer ${adminToken}`).send({ type: 'OUT', quantity: 99999 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

    const after = await request(app).get(`/api/products/${productId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.data.quantity_in_stock).toBe(qtyBefore);
  });

  test('rejects an invalid movement type', async () => {
    const res = await request(app).post(`/api/products/${productId}/stock-movements`).set('Authorization', `Bearer ${adminToken}`).send({ type: 'SIDEWAYS', quantity: 1 });
    expect(res.status).toBe(422);
  });

  test('rejects a zero quantity', async () => {
    const res = await request(app).post(`/api/products/${productId}/stock-movements`).set('Authorization', `Bearer ${adminToken}`).send({ type: 'IN', quantity: 0 });
    expect(res.status).toBe(422);
  });

  test('movement history is returned most-recent first', async () => {
    const res = await request(app).get(`/api/products/${productId}/stock-movements`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const dates = res.body.data.map((m) => new Date(m.created_at).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});
