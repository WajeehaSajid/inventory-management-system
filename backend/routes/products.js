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

// Confirms a category_id / supplier_id actually exists before we
// try to insert/update a product with it — gives a much clearer
// error than waiting for a raw foreign-key DB error.
const SINGULAR = { categories: 'category', suppliers: 'supplier' };

async function assertExists(table, id, label) {
  if (id === undefined || id === null) return;
  const result = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [id]);
  if (result.rows.length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', `${label}: no ${SINGULAR[table]} exists with this id.`);
  }
}

// -----------------------------------------------------
// GET /api/products?search=&category=&supplier=&status=&page=&pageSize=
//   search   -> matches name OR sku (case-insensitive, partial)
//   category -> category_id
//   supplier -> supplier_id
//   status   -> 'in_stock' | 'low_stock' (<10, >0) | 'out_of_stock' (0)
// -----------------------------------------------------
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('must be a positive integer'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('must be between 1 and 100'),
    query('category').optional().isInt().withMessage('must be an integer id'),
    query('supplier').optional().isInt().withMessage('must be an integer id'),
    query('status').optional().isIn(['in_stock', 'low_stock', 'out_of_stock']).withMessage('invalid value'),
  ],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const offset = (page - 1) * pageSize;

      const conditions = [];
      const params = [];

      if (req.query.search) {
        params.push(`%${req.query.search}%`);
        conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
      }
      if (req.query.category) {
        params.push(req.query.category);
        conditions.push(`category_id = $${params.length}`);
      }
      if (req.query.supplier) {
        params.push(req.query.supplier);
        conditions.push(`supplier_id = $${params.length}`);
      }
      if (req.query.status === 'out_of_stock') {
        conditions.push('quantity_in_stock = 0');
      } else if (req.query.status === 'low_stock') {
        conditions.push('quantity_in_stock > 0 AND quantity_in_stock < 10');
      } else if (req.query.status === 'in_stock') {
        conditions.push('quantity_in_stock >= 10');
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const totalResult = await pool.query(
        `SELECT COUNT(*) FROM products p ${whereClause}`,
        params
      );
      const total = parseInt(totalResult.rows[0].count);

      params.push(pageSize, offset);
      const dataResult = await pool.query(
        `SELECT p.*, c.name AS category_name, s.name AS supplier_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         ${whereClause}
         ORDER BY p.id
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
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
// GET /api/products/:id
// -----------------------------------------------------
router.get(
  '/:id',
  [param('id').isInt().withMessage('must be an integer')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await pool.query(
        `SELECT p.*, c.name AS category_name, s.name AS supplier_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.id = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Product not found.');
      }
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

const productValidationRules = [
  body('name').trim().notEmpty().withMessage('is required'),
  body('sku').trim().notEmpty().withMessage('is required'),
  body('description').optional().trim(),
  body('unit_price').isFloat({ min: 0 }).withMessage('must be a number >= 0'),
  body('quantity_in_stock').optional().isInt({ min: 0 }).withMessage('must be an integer >= 0'),
  body('category_id').optional({ nullable: true }).isInt().withMessage('must be an integer id'),
  body('supplier_id').optional({ nullable: true }).isInt().withMessage('must be an integer id'),
];

// -----------------------------------------------------
// POST /api/products
// -----------------------------------------------------
router.post('/', productValidationRules, async (req, res, next) => {
  try {
    checkValidation(req);
    const { name, sku, description, unit_price, category_id, supplier_id } = req.body;
    const quantity_in_stock = req.body.quantity_in_stock ?? 0;

    await assertExists('categories', category_id, 'category_id');
    await assertExists('suppliers', supplier_id, 'supplier_id');

    const result = await pool.query(
      `INSERT INTO products (name, sku, description, unit_price, quantity_in_stock, category_id, supplier_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, sku, description || null, unit_price, quantity_in_stock, category_id || null, supplier_id || null]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------
// PUT /api/products/:id
// -----------------------------------------------------
router.put(
  '/:id',
  [param('id').isInt().withMessage('must be an integer'), ...productValidationRules],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const { name, sku, description, unit_price, category_id, supplier_id } = req.body;
      const quantity_in_stock = req.body.quantity_in_stock ?? 0;

      await assertExists('categories', category_id, 'category_id');
      await assertExists('suppliers', supplier_id, 'supplier_id');

      const result = await pool.query(
        `UPDATE products
         SET name = $1, sku = $2, description = $3, unit_price = $4,
             quantity_in_stock = $5, category_id = $6, supplier_id = $7, updated_at = NOW()
         WHERE id = $8 RETURNING *`,
        [name, sku, description || null, unit_price, quantity_in_stock, category_id || null, supplier_id || null, req.params.id]
      );
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Product not found.');
      }
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// DELETE /api/products/:id
// stock_movements has ON DELETE CASCADE, so deleting a product
// cleanly removes its movement history too — this is intentional
// and documented in the README/design notes.
// -----------------------------------------------------
router.delete(
  '/:id',
  [param('id').isInt().withMessage('must be an integer')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Product not found.');
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// POST /api/products/:id/stock-movements
// Records a stock IN/OUT movement and atomically updates the
// product's quantity_in_stock in a single DB transaction:
//   1. BEGIN
//   2. Lock the product row (FOR UPDATE) so concurrent requests
//      can't both read the same "before" quantity
//   3. For OUT: reject if it would take stock negative
//   4. Insert the movement row
//   5. Update product.quantity_in_stock
//   6. COMMIT (or ROLLBACK on any failure)
// -----------------------------------------------------
router.post(
  '/:id/stock-movements',
  [
    param('id').isInt().withMessage('must be an integer'),
    body('type').isIn(['IN', 'OUT']).withMessage("must be 'IN' or 'OUT'"),
    body('quantity').isInt({ min: 1 }).withMessage('must be an integer >= 1'),
    body('reason').optional().trim(),
  ],
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      checkValidation(req);
      const productId = req.params.id;
      const { type, quantity, reason } = req.body;

      await client.query('BEGIN');

      const productResult = await client.query(
        'SELECT id, quantity_in_stock FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );
      if (productResult.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Product not found.');
      }

      const currentQty = productResult.rows[0].quantity_in_stock;
      const newQty = type === 'IN' ? currentQty + quantity : currentQty - quantity;

      if (newQty < 0) {
        throw new AppError(
          422,
          'INSUFFICIENT_STOCK',
          `Cannot remove ${quantity} unit(s): only ${currentQty} in stock.`
        );
      }

      const movementResult = await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reason)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [productId, type, quantity, reason || null]
      );

      const updatedProduct = await client.query(
        `UPDATE products SET quantity_in_stock = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [newQty, productId]
      );

      await client.query('COMMIT');

      res.status(201).json({
        data: {
          movement: movementResult.rows[0],
          product: updatedProduct.rows[0],
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// -----------------------------------------------------
// GET /api/products/:id/stock-movements
// History for a single product, most recent first.
// -----------------------------------------------------
router.get(
  '/:id/stock-movements',
  [param('id').isInt().withMessage('must be an integer')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const result = await pool.query(
        'SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC, id DESC',
        [req.params.id]
      );
      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
