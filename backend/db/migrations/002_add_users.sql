-- =====================================================
-- Migration 002: Users table (authentication)
-- =====================================================

DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(10) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
