const AppError = require('./AppError');

// Maps known PostgreSQL error codes to a clean HTTP response,
// so routes don't need to catch every DB error individually.
function mapDbError(err) {
  switch (err.code) {
    case '23505': // unique_violation (e.g. duplicate sku, duplicate category name)
      return new AppError(409, 'CONFLICT', 'A record with this value already exists.');
    case '23503': // foreign_key_violation (e.g. deleting a category still in use)
      return new AppError(409, 'FOREIGN_KEY_CONSTRAINT', 'This record is still referenced by other records and cannot be deleted or saved.');
    case '23514': // check_violation (e.g. negative quantity/price)
      return new AppError(422, 'VALIDATION_ERROR', 'One or more values violate a data constraint (e.g. negative quantity or price).');
    default:
      return null;
  }
}

// Express recognizes this as an error handler because it has 4 args.
// Must be registered LAST, after all routes.
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof AppError) && error.code) {
    const mapped = mapDbError(error);
    if (mapped) error = mapped;
  }

  if (!(error instanceof AppError)) {
    console.error('Unexpected error:', error);
    error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on the server.');
  }

  res.status(error.statusCode).json({
    error: {
      code: error.code,
      message: error.message,
    },
  });
}

module.exports = errorHandler;
