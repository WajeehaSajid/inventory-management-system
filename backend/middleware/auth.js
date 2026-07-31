const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

const JWT_SECRET = process.env.JWT_SECRET;

// Verifies the "Authorization: Bearer <token>" header on every protected
// route. On success, attaches { id, name, email, role } to req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header.'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token. Please log in again.'));
  }
}

// Use after requireAuth to restrict a route to specific roles, e.g.
// requireRole('admin') on DELETE routes.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', `This action requires one of these roles: ${allowedRoles.join(', ')}.`));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
