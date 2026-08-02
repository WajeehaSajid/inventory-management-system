const pool = require('../db/pool');
const { app, request, loginAs } = require('./helpers');

let adminToken;

beforeAll(async () => {
  adminToken = await loginAs('admin');
});

afterAll(() => pool.end());

describe('Dashboard', () => {
  test('summary requires authentication', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });

  test('summary returns product/category/supplier counts', async () => {
    const res = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('categories');
    expect(res.body.data).toHaveProperty('suppliers');
  });

  test('stock-trend returns one entry per requested day', async () => {
    const res = await request(app).get('/api/dashboard/stock-trend?days=5').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
  });

  test('stock-trend rejects an out-of-range days value', async () => {
    const res = await request(app).get('/api/dashboard/stock-trend?days=999').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(422);
  });

  test('category-breakdown returns a count per category', async () => {
    const res = await request(app).get('/api/dashboard/category-breakdown').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('count');
  });

  test('top-products respects the limit parameter', async () => {
    const res = await request(app).get('/api/dashboard/top-products?limit=3').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });
});
