-- Migration: Add packaging fields to cart_items table
-- Date: 2025-02-11
-- Description: Aggiunge campi per gestire i cartoni/packaging di Odoo

-- Add packaging fields to cart_items
ALTER TABLE cart_items
ADD COLUMN IF NOT EXISTS packaging_qty DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS packaging_name VARCHAR(255);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_cart_items_packaging ON cart_items(packaging_qty) WHERE packaging_qty IS NOT NULL;

-- Add comment
COMMENT ON COLUMN cart_items.packaging_qty IS 'Quantità di unità per ogni cartone/packaging (es. 5.40 kg per cartone)';
COMMENT ON COLUMN cart_items.packaging_name IS 'Nome del packaging (es. "Cartone", "Box", etc.)';
