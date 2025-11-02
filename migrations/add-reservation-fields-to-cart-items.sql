-- Migration: Add reservation fields to cart_items table
-- Purpose: Allow cart items to store product reservation data (notes, audio, photos)
--          for out-of-stock products, which will be sent to Odoo Chatter on order confirmation
-- Date: 2025-11-02

BEGIN;

-- Add reservation-related fields to cart_items table
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS is_reservation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reservation_text_note TEXT,
  ADD COLUMN IF NOT EXISTS reservation_audio_url VARCHAR(512),
  ADD COLUMN IF NOT EXISTS reservation_image_url VARCHAR(512),
  ADD COLUMN IF NOT EXISTS reservation_audio_odoo_attachment_id INTEGER,
  ADD COLUMN IF NOT EXISTS reservation_image_odoo_attachment_id INTEGER,
  ADD COLUMN IF NOT EXISTS reservation_created_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the new fields
COMMENT ON COLUMN cart_items.is_reservation IS 'True if this cart item is a product reservation (for out-of-stock items)';
COMMENT ON COLUMN cart_items.reservation_text_note IS 'Customer text note for reserved product';
COMMENT ON COLUMN cart_items.reservation_audio_url IS 'URL to audio recording stored in Vercel Blob';
COMMENT ON COLUMN cart_items.reservation_image_url IS 'URL to image/photo stored in Vercel Blob';
COMMENT ON COLUMN cart_items.reservation_audio_odoo_attachment_id IS 'Odoo ir.attachment ID for audio file';
COMMENT ON COLUMN cart_items.reservation_image_odoo_attachment_id IS 'Odoo ir.attachment ID for image file';
COMMENT ON COLUMN cart_items.reservation_created_at IS 'Timestamp when reservation was created';

-- Create index for filtering reservation items
CREATE INDEX IF NOT EXISTS idx_cart_items_reservation
  ON cart_items(cart_id, is_reservation)
  WHERE is_reservation = TRUE;

COMMIT;
