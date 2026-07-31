const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../db/pool');
const AppError = require('../middleware/AppError');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: turns express-validator errors into our consistent error format.
function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const messages = result.array().map((e) => `${e.path}: ${e.msg}`).join('; ');
    throw new AppError(422, 'VALIDATION_ERROR', messages);
  }
}

// -----------------------------------------------------
// GET /api/categories?page=&pageSize=
// -----------------------------------------------------
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('must be a positive integer'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('must be between 1 and 100'),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const offset = (page - 1) * pageSize;

      const totalResult = await pool.query('SELECT COUNT(*) FROM categories');
      const total = parseInt(totalResult.rows[0].count);

      const dataResult = await pool.query(
        'SELECT * FROM categories ORDER BY id LIMIT $1 OFFSET $2',
        [pageSize, offset]
      );

      res.json({
        data: dataResult.rows,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// GET /api/categories/:id
// -----------------------------------------------------
router.get(
  '/:id',
  [param('id').isInt().withMessage('must be an integer')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Category not found.');
      }
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// POST /api/categories
// -----------------------------------------------------
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('is required'),
    body('description').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { name, description } = req.body;
      const result = await pool.query(
        'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
        [name, description || null]
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// PUT /api/categories/:id
// -----------------------------------------------------
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('must be an integer'),
    body('name').trim().notEmpty().withMessage('is required'),
    body('description').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { name, description } = req.body;
      const result = await pool.query(
        'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [name, description || null, req.params.id]
      );
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Category not found.');
      }
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// DELETE /api/categories/:id
// Blocked at the DB level (ON DELETE RESTRICT) if products still
// reference this category — that DB error is translated into a
// clean 409 by the central error handler. We also do a friendlier
// pre-check here so the message is more specific.
// -----------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin'),
  [param('id').isInt().withMessage('must be an integer')],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const inUse = await pool.query(
        'SELECT COUNT(*) FROM products WHERE category_id = $1',
        [req.params.id]
      );
      if (parseInt(inUse.rows[0].count) > 0) {
        throw new AppError(
          409,
          'CATEGORY_IN_USE',
          `Cannot delete category: ${inUse.rows[0].count} product(s) still reference it.`
        );
      }

      const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Category not found.');
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
