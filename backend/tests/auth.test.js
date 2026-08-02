const pool = require('../db/pool');
const { app, request, loginAs, unique } = require('./helpers');

afterAll(() => pool.end());

describe('Authentication', () => {
  test('protected route rejects requests with no token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('protected route rejects a garbage token', async () => {
    const res = await request(app).get('/api/products').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('admin can log in and receives a token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@inventory.com', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
    expect(typeof res.body.data.token).toBe('string');
  });

  test('staff can log in and receives a token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'staff@inventory.com', password: 'staff123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('staff');
  });

  test('login with wrong password is rejected', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@inventory.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('register creates a new account with the staff role by default', async () => {
    const email = `test-${unique()}@inventory.com`;
    const res = await request(app).post('/api/auth/register').send({ name: 'Test User', email, password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('staff');
    expect(res.body.data.user.email).toBe(email);
  });

  test('register rejects a short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Bad', email: `bad-${unique()}@inventory.com`, password: '123' });
    expect(res.status).toBe(422);
  });

  test('GET /api/auth/me returns the authenticated user', async () => {
    const token = await loginAs('admin');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@inventory.com');
  });

  test('change-password rejects an incorrect current password', async () => {
    const email = `pwtest-${unique()}@inventory.com`;
    await request(app).post('/api/auth/register').send({ name: 'PW Test', email, password: 'originalpass' });
    const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'originalpass' });
    const token = loginRes.body.data.token;

    const res = await request(app).put('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({
      currentPassword: 'wrongpassword', newPassword: 'newpassword123',
    });
    expect(res.status).toBe(401);
  });

  test('change-password succeeds and the new password works on next login', async () => {
    const email = `pwtest2-${unique()}@inventory.com`;
    await request(app).post('/api/auth/register').send({ name: 'PW Test 2', email, password: 'originalpass' });
    const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'originalpass' });
    const token = loginRes.body.data.token;

    const changeRes = await request(app).put('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({
      currentPassword: 'originalpass', newPassword: 'brandnewpass',
    });
    expect(changeRes.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: 'originalpass' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ email, password: 'brandnewpass' });
    expect(newLogin.status).toBe(200);
  });

  test('update profile changes the display name', async () => {
    const email = `nametest-${unique()}@inventory.com`;
    const registerRes = await request(app).post('/api/auth/register').send({ name: 'Original Name', email, password: 'password123' });
    const token = registerRes.body.data.token;

    const res = await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${token}`).send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Updated Name');
  });
});
