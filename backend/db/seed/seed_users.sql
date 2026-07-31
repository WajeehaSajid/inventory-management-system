-- =====================================================
-- Seed: default users for login testing
-- Run AFTER 002_add_users.sql
--
-- Default credentials (change after first login in a real deployment):
--   Admin:  admin@inventory.com / admin123
--   Staff:  staff@inventory.com / staff123
-- =====================================================

INSERT INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@inventory.com', '$2b$10$c1KINxwiwqJF1HTn0EvLte5tpRvLsblVkIqE5kvERCU1hCQgphRIS', 'admin'),
('Staff User', 'staff@inventory.com', '$2b$10$qnkBBwi84NnE9FhvPu440.EM8vkP34nGqezVqlxyPOqh/ZQUypJeC', 'staff');
