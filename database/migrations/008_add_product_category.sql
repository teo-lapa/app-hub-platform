-- Add product category to order lines
-- This allows us to calculate spending by category per customer

ALTER TABLE maestro_order_lines
ADD COLUMN IF NOT EXISTS product_category VARCHAR(255);

-- Create index for category queries
CREATE INDEX IF NOT EXISTS idx_order_lines_category
ON maestro_order_lines(product_category);

-- Add comment
COMMENT ON COLUMN maestro_order_lines.product_category IS 'Product category from Odoo (e.g., Farina, Mozzarella, etc.)';
