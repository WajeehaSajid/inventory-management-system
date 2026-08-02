const pool = require('../db/pool');
const { app, request, loginAs, unique } = require('./helpers');

let adminToken, staffToken;

beforeAll(async () => {
  adminToken = await loginAs('admin');
  staffToken = await loginAs('staff');
});

afterAll(() => pool.end());

describe('Categories', () => {
  test('list categories is paginated', async () => {
    const res = await request(app).get('/api/categories?page=1&pageSize=2').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination).toHaveProperty('total');
  });

  test('create category succeeds with a valid name', async () => {
    const name = `Test Category ${unique()}`;
    const res = await request(app).post('/api/categories').set('Authorization', `Bearer ${adminToken}`).send({ name, description: 'Created by Jest' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(name);
  });

  test('create category rejects an empty name', async () => {
    const res = await request(app).post('/api/categories').set('Authorization', `Bearer ${adminToken}`).send({ name: '' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('create category rejects a duplicate name', async () => {
    const name = `Dup Category ${unique()}`;
    await request(app).post('/api/categories').set('Authorization', `Bearer ${adminToken}`).send({ name });
    const res = await request(app).post('/api/categories').set('Authorization', `Bearer ${adminToken}`).send({ name });
    expect(res.status).toBe(409);
  });

  test('staff cannot delete a category', async () => {
    const created = await request(app).post('/api/categories').set('Authorization', `Bearer ${adminToken}`).send({ name: `Staff Delete Test ${unique()}` });
    const res = await request(app).delete(`/api/categories/${created.body.data.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('admin can delete an unused category', async () => {
    const created = await request(app).post('/api/categories').set('Authorization', `Bearer ${adminToken}`).send({ name: `Admin Delete Test ${unique()}` });
    const res = await request(app).delete(`/api/categories/${created.body.data.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  test('deleting a category still referenced by products is blocked', async () => {
    // Category id 1 is seeded with products attached.
    const res = await request(app).delete('/api/categories/1').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_IN_USE');
  });
});
