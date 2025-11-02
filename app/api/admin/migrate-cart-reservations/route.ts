import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/migrate-cart-reservations
 *
 * Temporary endpoint to run database migration for cart reservation fields
 * Should be called once and then deleted
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [MIGRATION] Starting cart_items reservation fields migration...');

    // Add reservation-related fields to cart_items table
    await sql`
      ALTER TABLE cart_items
        ADD COLUMN IF NOT EXISTS is_reservation BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS reservation_text_note TEXT,
        ADD COLUMN IF NOT EXISTS reservation_audio_url VARCHAR(512),
        ADD COLUMN IF NOT EXISTS reservation_image_url VARCHAR(512),
        ADD COLUMN IF NOT EXISTS reservation_audio_odoo_attachment_id INTEGER,
        ADD COLUMN IF NOT EXISTS reservation_image_odoo_attachment_id INTEGER,
        ADD COLUMN IF NOT EXISTS reservation_created_at TIMESTAMP WITH TIME ZONE
    `;

    console.log('✅ [MIGRATION] Columns added successfully');

    // Add comments
    await sql`
      COMMENT ON COLUMN cart_items.is_reservation IS 'True if this cart item is a product reservation (for out-of-stock items)'
    `;
    await sql`
      COMMENT ON COLUMN cart_items.reservation_text_note IS 'Customer text note for reserved product'
    `;
    await sql`
      COMMENT ON COLUMN cart_items.reservation_audio_url IS 'URL to audio recording stored in Vercel Blob'
    `;
    await sql`
      COMMENT ON COLUMN cart_items.reservation_image_url IS 'URL to image/photo stored in Vercel Blob'
    `;
    await sql`
      COMMENT ON COLUMN cart_items.reservation_audio_odoo_attachment_id IS 'Odoo ir.attachment ID for audio file'
    `;
    await sql`
      COMMENT ON COLUMN cart_items.reservation_image_odoo_attachment_id IS 'Odoo ir.attachment ID for image file'
    `;
    await sql`
      COMMENT ON COLUMN cart_items.reservation_created_at IS 'Timestamp when reservation was created'
    `;

    console.log('✅ [MIGRATION] Comments added successfully');

    // Create index for filtering reservation items
    await sql`
      CREATE INDEX IF NOT EXISTS idx_cart_items_reservation
        ON cart_items(cart_id, is_reservation)
        WHERE is_reservation = TRUE
    `;

    console.log('✅ [MIGRATION] Index created successfully');

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('💥 [MIGRATION] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Migration failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
