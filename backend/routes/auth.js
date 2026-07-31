const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const AppError = require('../middleware/AppError');
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;
