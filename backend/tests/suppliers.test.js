const pool = require('../db/pool');
const { app, request, loginAs, unique } = require('./helpers');

let adminToken, staffToken;

beforeAll(async () => {
  adminToken = await loginAs('admin');
  staffToken = await loginAs('staff');
});

afterAll(() => pool.end());

describe('Suppliers', () => {
  test('list suppliers is paginated', async () => {
    const res = await request(app).get('/api/suppliers?page=1&pageSize=2').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toHaveProperty('total');
  });

  test('create supplier rejects an invalid email', async () => {
    const res = await request(app).post('/api/suppliers').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Bad Supplier', contact_email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  test('create supplier succeeds with a valid payload', async () => {
    const res = await request(app).post('/api/suppliers').set('Authorization', `Bearer ${adminToken}`).send({
      name: `Test Supplier ${unique()}`,
      contact_email: `supplier-${unique()}@example.com`,
      phone: '+92-300-0000000',
    });
    expect(res.status).toBe(201);
  });

  test('staff cannot delete a supplier', async () => {
    const created = await request(app).post('/api/suppliers').set('Authorization', `Bearer ${adminToken}`).send({
      name: `Staff Delete Test ${unique()}`, contact_email: `sdt-${unique()}@example.com`,
    });
    const res = await request(app).delete(`/api/suppliers/${created.body.data.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('deleting a supplier still referenced by products is blocked', async () => {
    const res = await request(app).delete('/api/suppliers/1').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SUPPLIER_IN_USE');
  });
});
