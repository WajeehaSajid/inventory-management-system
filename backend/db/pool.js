// Central PostgreSQL connection pool.
// Every route/query in the app imports this same pool instead of
// opening a new connection each time — this is what makes the
// stock-movement update "atomic" later (we can run a transaction
// on a single client from this pool).

require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

// Two ways to configure the connection:
//  - DATABASE_URL (e.g. Neon, Supabase, Railway) — a single connection
//    string, used in production/Vercel. These providers require SSL.
//  - DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD — used for local
//    development against a Postgres instance on your own machine.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
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