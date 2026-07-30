require('dotenv').config();
const express = require('express');
const cors = require('cors');

const errorHandler = require('./middleware/errorHandler');
const AppError = require('./middleware/AppError');

const app = express();

app.use(cors());
app.use(express.json());

// Simple health check — confirms the server (and later, the DB) is reachable.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/categories', require('./routes/categories'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/products', require('./routes/products'));

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
