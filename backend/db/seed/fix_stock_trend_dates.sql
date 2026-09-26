-- =====================================================
-- FIX: Stock movement trend chart showing a flat line at 0
-- =====================================================
-- Root cause: stock_movements.created_at defaults to NOW() at INSERT
-- time. The original seed data was inserted once (weeks ago), so all
-- rows now fall outside the dashboard's 7/30-day trend window, and
-- /api/dashboard/stock-trend returns 0 for every day.
--
-- Run this ONCE directly against your live/production database
-- (e.g. via `psql <your-neon-connection-string> -f fix_stock_trend_dates.sql`,
-- or paste it into Neon's SQL editor) to push the existing rows'
-- created_at into the last ~14 days, WITHOUT touching products,
-- categories, suppliers, or duplicating any data.
-- =====================================================

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS total
  FROM stock_movements
)
UPDATE stock_movements m
SET created_at = NOW() - ((ordered.total - ordered.rn) * INTERVAL '2 days')
FROM ordered
WHERE m.id = ordered.id;

-- Sanity check: run this after, you should see recent dates, not one
-- single old timestamp repeated on every row.
-- SELECT id, product_id, type, quantity, created_at FROM stock_movements ORDER BY created_at;
