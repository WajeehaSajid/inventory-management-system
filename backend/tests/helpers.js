const request = require('supertest');
const app = require('../server');

async function loginAs(role) {
  const creds = role === 'admin'
    ? { email: 'admin@inventory.com', password: 'admin123' }
    : { email: 'staff@inventory.com', password: 'staff123' };
  const res = await request(app).post('/api/auth/login').send(creds);
  if (!res.body.data) {
    throw new Error(
      `Could not log in as ${role}. Make sure you've run db/seed/seed_users.sql against your database.`
    );
  }
  return res.body.data.token;
}

// A short random suffix so tests that create records (unique SKU/email/
// name) don't collide with each other on repeated test runs.
function unique() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

module.exports = { app, request, loginAs, unique };
