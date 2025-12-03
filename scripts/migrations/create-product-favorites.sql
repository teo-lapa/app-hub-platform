-- Migration: Create product_favorites table
-- Purpose: Store customer product favorites (stellina) for Portale Clienti
-- Date: 2025-12-03

-- Create the product_favorites table
CREATE TABLE IF NOT EXISTS product_favorites (
  id SERIAL PRIMARY KEY,
  customer_email VARCHAR(255) NOT NULL,
  product_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_email, product_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_favorites_customer ON product_favorites(customer_email);
CREATE INDEX IF NOT EXISTS idx_product_favorites_product ON product_favorites(product_id);

-- Comment on table
COMMENT ON TABLE product_favorites IS 'Stores product favorites (stellina) for each customer in Portale Clienti';
COMMENT ON COLUMN product_favorites.customer_email IS 'Email of the customer (from JWT token)';
COMMENT ON COLUMN product_favorites.product_id IS 'Odoo product.product ID';
