const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const AppError = require('../middleware/AppError');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const messages = result.array().map((e) => `${e.path}: ${e.msg}`).join('; ');
    throw new AppError(422, 'VALIDATION_ERROR', messages);
  }
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// -----------------------------------------------------
// POST /api/auth/register
// Public signup. Always creates a 'staff' account — admin accounts
// are seeded directly in the database, not self-served, so that
// anyone who can reach this endpoint can't grant themselves admin.
// -----------------------------------------------------
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('is required'),
    body('email').trim().isEmail().withMessage('must be a valid email'),
    body('password').isLength({ min: 6 }).withMessage('must be at least 6 characters'),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { name, email, password } = req.body;
      const password_hash = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'staff') RETURNING id, name, email, role`,
        [name, email.toLowerCase(), password_hash]
      );

      const user = result.rows[0];
      res.status(201).json({ data: { user, token: signToken(user) } });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// POST /api/auth/login
// -----------------------------------------------------
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('must be a valid email'),
    body('password').notEmpty().withMessage('is required'),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { email, password } = req.body;

      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
      const user = result.rows[0];

      // Same error for "no such user" and "wrong password" — don't leak
      // which one it was, that's an account-enumeration risk.
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
      }

      const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
      res.json({ data: { user: publicUser, token: signToken(publicUser) } });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// GET /api/auth/me
// Lets the frontend verify a stored token is still valid on page load.
// -----------------------------------------------------
router.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user });
});

// -----------------------------------------------------
// PUT /api/auth/profile
// Update the current user's display name.
// -----------------------------------------------------
router.put(
  '/profile',
  requireAuth,
  [body('name').trim().notEmpty().withMessage('is required')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await pool.query(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role',
        [req.body.name, req.user.id]
      );
      const user = result.rows[0];
      res.json({ data: { user, token: signToken(user) } });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// PUT /api/auth/change-password
// Requires the current password as proof of identity before setting
// a new one — this isn't optional even though the user is already
// logged in, since a stolen/left-open session shouldn't be enough
// to lock the real owner out of their account.
// -----------------------------------------------------
router.put(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty().withMessage('is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('must be at least 6 characters'),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { currentPassword, newPassword } = req.body;

      const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      const user = result.rows[0];

      if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

      res.json({ data: { message: 'Password updated successfully.' } });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// GET /api/auth/users
// Admin-only. Lists every account so an admin can manage roles.
// -----------------------------------------------------
router.get('/users', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC'
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------
// PUT /api/auth/users/:id/role
// Admin-only. Promotes/demotes another account between staff and admin.
// An admin can't change their own role here — that's a deliberate
// guard against a single admin accidentally locking themselves out.
// -----------------------------------------------------
router.put(
  '/users/:id/role',
  requireAuth,
  requireRole('admin'),
  [body('role').isIn(['admin', 'staff']).withMessage('must be "admin" or "staff"')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const targetId = Number(req.params.id);

      if (targetId === req.user.id) {
        throw new AppError(400, 'CANNOT_CHANGE_OWN_ROLE', "You can't change your own role.");
      }

      const result = await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, created_at',
        [req.body.role, targetId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'User not found.');
      }

      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
