-- =====================================================
-- Product Inventory Management System - Initial Schema
-- =====================================================

-- Drop tables if they exist (clean re-run during development)
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- =====================================================
-- CATEGORIES
-- =====================================================
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    description TEXT
);

-- =====================================================
-- SUPPLIERS
-- =====================================================
CREATE TABLE suppliers (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    phone         VARCHAR(30),
    address       TEXT
);

-- =====================================================
-- PRODUCTS
-- =====================================================
CREATE TABLE products (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(200) NOT NULL,
    sku               VARCHAR(100) NOT NULL UNIQUE,
    description       TEXT,
    unit_price        NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
    category_id       INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
    supplier_id       INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- STOCK MOVEMENTS
-- =====================================================
CREATE TABLE stock_movements (
    id         SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type       VARCHAR(3) NOT NULL CHECK (type IN ('IN', 'OUT')),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    reason     VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES (for search / filter / pagination performance)
-- =====================================================
CREATE INDEX idx_products_name ON products (name);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_supplier_id ON products (supplier_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements (product_id);
