// Central PostgreSQL connection pool.
// Every route/query in the app imports this same pool instead of
// opening a new connection each time — this is what makes the
// stock-movement update "atomic" later (we can run a transaction
// on a single client from this pool).

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
