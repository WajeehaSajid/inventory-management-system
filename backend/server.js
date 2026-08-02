require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const errorHandler = require('./middleware/errorHandler');
const AppError = require('./middleware/AppError');
const { requireAuth } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());

// Simple health check — confirms the server (and later, the DB) is reachable.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Interactive API docs — no auth needed to browse the docs themselves,
// only to actually call the endpoints (use the "Authorize" button with
// a token from POST /api/auth/login).
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// Auth routes are public (you need them to log in in the first place).
app.use('/api/auth', require('./routes/auth'));

// Everything below requires a valid logged-in user. Delete permissions
// (admin-only) are enforced inside each route file, since only some
// routes need that extra restriction.
app.use('/api/categories', requireAuth, require('./routes/categories'));
app.use('/api/suppliers', requireAuth, require('./routes/suppliers'));
app.use('/api/products', requireAuth, require('./routes/products'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));

// Catch-all for unknown routes -> consistent 404 error format
app.use((req, res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`));
});

// Central error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
