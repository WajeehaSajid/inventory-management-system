// A small custom error class so routes can throw errors with a
// specific HTTP status + machine-readable code, and the central
// error handler (errorHandler.js) turns it into the consistent
// { error: { code, message } } JSON shape.

class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = AppError;
