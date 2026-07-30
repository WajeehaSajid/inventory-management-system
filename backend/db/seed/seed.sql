-- =====================================================
-- Seed Data - Product Inventory Management System
-- Run AFTER 001_init_schema.sql
-- =====================================================

-- =====================================================
-- CATEGORIES (3)
-- =====================================================
INSERT INTO categories (name, description) VALUES
('Electronics', 'Electronic gadgets and accessories'),
('Office Supplies', 'Everyday office and stationery items'),
('Home Appliances', 'Appliances for household use');

-- =====================================================
-- SUPPLIERS (3)
-- =====================================================
INSERT INTO suppliers (name, contact_email, phone, address) VALUES
('TechSource Traders', 'sales@techsource.com', '+92-300-1234567', 'Plot 12, Industrial Area, Lahore'),
('Global Office Mart', 'contact@globalofficemart.com', '+92-321-7654321', 'Shop 45, Blue Area, Islamabad'),
('HomeEase Distributors', 'info@homeease.com', '+92-333-9988776', 'Warehouse 3, Korangi, Karachi');

-- =====================================================
-- PRODUCTS (20)
-- category_id: 1=Electronics, 2=Office Supplies, 3=Home Appliances
-- supplier_id: 1=TechSource, 2=Global Office Mart, 3=HomeEase
-- =====================================================
INSERT INTO products (name, sku, description, unit_price, quantity_in_stock, category_id, supplier_id) VALUES
('Wireless Mouse', 'ELEC-001', 'Ergonomic 2.4GHz wireless mouse', 1200.00, 45, 1, 1),
('Mechanical Keyboard', 'ELEC-002', 'RGB backlit mechanical keyboard', 6500.00, 25, 1, 1),
('USB-C Hub', 'ELEC-003', '7-in-1 USB-C multiport adapter', 3200.00, 8, 1, 1),
('Bluetooth Speaker', 'ELEC-004', 'Portable waterproof speaker', 4500.00, 30, 1, 1),
('Webcam 1080p', 'ELEC-005', 'Full HD webcam with microphone', 3800.00, 0, 1, 1),
('Power Bank 20000mAh', 'ELEC-006', 'Fast-charging portable power bank', 3500.00, 60, 1, 1),
('HDMI Cable 2m', 'ELEC-007', 'High-speed HDMI 2.1 cable', 800.00, 100, 1, 1),
('Laptop Stand', 'ELEC-008', 'Adjustable aluminum laptop stand', 2200.00, 5, 1, 1),
('A4 Paper Ream', 'OFF-001', '500 sheets, 80gsm A4 paper', 650.00, 200, 2, 2),
('Ballpoint Pen Box', 'OFF-002', 'Box of 50 blue ballpoint pens', 900.00, 150, 2, 2),
('Stapler Heavy Duty', 'OFF-003', 'Metal heavy-duty stapler', 1100.00, 40, 2, 2),
('Sticky Notes Pack', 'OFF-004', 'Pack of 12 sticky note pads', 480.00, 9, 2, 2),
('Office Chair', 'OFF-005', 'Ergonomic mesh office chair', 15000.00, 12, 2, 2),
('Whiteboard Marker Set', 'OFF-006', 'Set of 8 assorted colors', 700.00, 0, 2, 2),
('Filing Cabinet', 'OFF-007', '3-drawer steel filing cabinet', 18500.00, 6, 2, 2),
('Microwave Oven', 'HOME-001', '23L solo microwave oven', 22000.00, 15, 3, 3),
('Electric Kettle', 'HOME-002', '1.7L stainless steel kettle', 3200.00, 35, 3, 3),
('Vacuum Cleaner', 'HOME-003', 'Bagless cyclonic vacuum cleaner', 28000.00, 4, 3, 3),
('Table Fan', 'HOME-004', '16-inch high-speed table fan', 5200.00, 22, 3, 3),
('Air Fryer', 'HOME-005', '4.5L digital air fryer', 19500.00, 10, 3, 3);

-- =====================================================
-- SAMPLE STOCK MOVEMENTS (a few, to show history works)
-- =====================================================
INSERT INTO stock_movements (product_id, type, quantity, reason) VALUES
(1, 'IN', 50, 'Initial stock received'),
(1, 'OUT', 5, 'Sold to customer'),
(3, 'IN', 10, 'Initial stock received'),
(3, 'OUT', 2, 'Sold to customer'),
(5, 'IN', 10, 'Initial stock received'),
(5, 'OUT', 10, 'Sold out - clearance');
