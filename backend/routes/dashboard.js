const express = require('express');
const { query, validationResult } = require('express-validator');
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
// GET /api/dashboard/summary
// Top-level counts for the summary cards (products, categories,
// suppliers, stock status breakdown, and total inventory value).
// -----------------------------------------------------
router.get('/summary', async (req, res, next) => {
  try {
    const [productCounts, categoryCount, supplierCount, inventoryValue, movementCount] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE quantity_in_stock = 0) AS out_of_stock,
          COUNT(*) FILTER (WHERE quantity_in_stock > 0 AND quantity_in_stock < 10) AS low_stock,
          COUNT(*) FILTER (WHERE quantity_in_stock >= 10) AS in_stock
        FROM products
      `),
      pool.query('SELECT COUNT(*) AS total FROM categories'),
      pool.query('SELECT COUNT(*) AS total FROM suppliers'),
      pool.query('SELECT COALESCE(SUM(unit_price * quantity_in_stock), 0) AS total FROM products'),
      pool.query('SELECT COUNT(*) AS total FROM stock_movements'),
    ]);

    const p = productCounts.rows[0];
    res.json({
      data: {
        products: {
          total: parseInt(p.total),
          in_stock: parseInt(p.in_stock),
          low_stock: parseInt(p.low_stock),
          out_of_stock: parseInt(p.out_of_stock),
        },
        categories: parseInt(categoryCount.rows[0].total),
        suppliers: parseInt(supplierCount.rows[0].total),
        inventory_value: parseFloat(inventoryValue.rows[0].total),
        stock_movements: parseInt(movementCount.rows[0].total),
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------
// GET /api/dashboard/stock-trend?days=7
// Daily totals of IN vs OUT quantity, for a line/bar chart.
// Days with no movements still appear, with 0s, so the chart's
// x-axis doesn't have gaps.
// -----------------------------------------------------
router.get(
  '/stock-trend',
  [query('days').optional().isInt({ min: 1, max: 90 }).withMessage('must be between 1 and 90')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const days = parseInt(req.query.days) || 7;

      const result = await pool.query(
        `
        SELECT
          d::date AS day,
          COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'IN'), 0) AS stock_in,
          COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT'), 0) AS stock_out
        FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day') AS d
        LEFT JOIN stock_movements m ON m.created_at::date = d::date
        GROUP BY d
        ORDER BY d
        `,
        [days]
      );

      res.json({
        data: result.rows.map((row) => ({
          date: row.day.toISOString().split('T')[0],
          stock_in: parseInt(row.stock_in),
          stock_out: parseInt(row.stock_out),
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------
// GET /api/dashboard/category-breakdown
// Product count per category, for a pie/donut chart.
// -----------------------------------------------------
router.get('/category-breakdown', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.name, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY product_count DESC
    `);
    res.json({
      data: result.rows.map((row) => ({ name: row.name, count: parseInt(row.product_count) })),
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------
// GET /api/dashboard/top-products?limit=5
// Highest inventory value (unit_price * quantity_in_stock) —
// meaningful for an inventory system, where we don't track sales.
// -----------------------------------------------------
router.get(
  '/top-products',
  [query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('must be between 1 and 50')],
  async (req, res, next) => {
    try {
      checkValidation(req);
      const limit = parseInt(req.query.limit) || 5;

      const result = await pool.query(
        `
        SELECT name, sku, quantity_in_stock, unit_price,
               (unit_price * quantity_in_stock) AS inventory_value
        FROM products
        ORDER BY inventory_value DESC
        LIMIT $1
        `,
        [limit]
      );

      res.json({
        data: result.rows.map((row) => ({
          name: row.name,
          sku: row.sku,
          quantity_in_stock: row.quantity_in_stock,
          unit_price: parseFloat(row.unit_price),
          inventory_value: parseFloat(row.inventory_value),
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
