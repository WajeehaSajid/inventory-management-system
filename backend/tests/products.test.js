const pool = require('../db/pool');
const { app, request, loginAs, unique } = require('./helpers');

let adminToken;

beforeAll(async () => {
  adminToken = await loginAs('admin');
});

afterAll(() => pool.end());

describe('Products', () => {
  test('search matches name or SKU', async () => {
    const res = await request(app).get('/api/products?search=Mouse').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('filter by stock status returns only matching products', async () => {
    const res = await request(app).get('/api/products?status=out_of_stock').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((p) => expect(p.quantity_in_stock).toBe(0));
  });

  test('create product rejects a negative price', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Bad Price', sku: `JEST-BAD-${unique()}`, unit_price: -10,
    });
    expect(res.status).toBe(422);
  });

  test('create product rejects a duplicate SKU', async () => {
    const sku = `JEST-DUP-${unique()}`;
    await request(app).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({ name: 'First', sku, unit_price: 10 });
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Second', sku, unit_price: 20 });
    expect(res.status).toBe(409);
  });

  test('create product rejects an invalid category_id', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Bad Category', sku: `JEST-CAT-${unique()}`, unit_price: 10, category_id: 999999,
    });
    expect(res.status).toBe(422);
  });

  test('full lifecycle: create, update, delete', async () => {
    const sku = `JEST-LIFECYCLE-${unique()}`;
    const created = await request(app).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Lifecycle Product', sku, unit_price: 50, quantity_in_stock: 5,
    });
    expect(created.status).toBe(201);

    const updated = await request(app).put(`/api/products/${created.body.data.id}`).set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Lifecycle Product Updated', sku, unit_price: 75, quantity_in_stock: 5,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Lifecycle Product Updated');

    const deleted = await request(app).delete(`/api/products/${created.body.data.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(204);
  });
});
