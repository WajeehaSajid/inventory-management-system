const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../db/pool');
const AppError = require('../middleware/AppError');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const messages = result.array().map((e) => `${e.path}: ${e.msg}`).join('; ');
    throw new AppError(422, 'VALIDATION_ERROR', messages);
  }
}

// -----------------------------------------------------
// GET /api/suppliers?page=&pageSize=
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

      const totalResult = await pool.query('SELECT COUNT(*) FROM suppliers');
      const total = parseInt(totalResult.rows[0].count);

      const dataResult = await pool.query(
        'SELECT * FROM suppliers ORDER BY id LIMIT $1 OFFSET $2',
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
// GET /api/suppliers/:id
// -----------------------------------------------------
router.get(
  '/:id',
  [param('id').isInt().withMessage('must be an integer')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Supplier not found.');
      }
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// POST /api/suppliers
// -----------------------------------------------------
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('is required'),
    body('contact_email').trim().isEmail().withMessage('must be a valid email'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { name, contact_email, phone, address } = req.body;
      const result = await pool.query(
        'INSERT INTO suppliers (name, contact_email, phone, address) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, contact_email, phone || null, address || null]
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// PUT /api/suppliers/:id
// -----------------------------------------------------
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('must be an integer'),
    body('name').trim().notEmpty().withMessage('is required'),
    body('contact_email').trim().isEmail().withMessage('must be a valid email'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { name, contact_email, phone, address } = req.body;
      const result = await pool.query(
        'UPDATE suppliers SET name = $1, contact_email = $2, phone = $3, address = $4 WHERE id = $5 RETURNING *',
        [name, contact_email, phone || null, address || null, req.params.id]
      );
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Supplier not found.');
      }
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// DELETE /api/suppliers/:id
// Same "in use" protection pattern as categories.
// -----------------------------------------------------
router.delete(
  '/:id',
  [param('id').isInt().withMessage('must be an integer')],
  async (req, res, next) => {
    try {
      checkValidation(req);

      const inUse = await pool.query(
        'SELECT COUNT(*) FROM products WHERE supplier_id = $1',
        [req.params.id]
      );
      if (parseInt(inUse.rows[0].count) > 0) {
        throw new AppError(
          409,
          'SUPPLIER_IN_USE',
          `Cannot delete supplier: ${inUse.rows[0].count} product(s) still reference it.`
        );
      }

      const result = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Supplier not found.');
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
