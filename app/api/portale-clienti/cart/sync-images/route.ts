import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/portale-clienti/cart/sync-images
 *
 * Aggiorna le immagini dei prodotti esistenti nel carrello
 * recuperandole da Odoo
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🖼️ [SYNC-IMAGES] Inizio sincronizzazione immagini carrello');

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError: any) {
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Get partner_id from Odoo
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 401 }
      );
    }

    const partnerId = userPartners[0].id;

    // Get cart
    const cartResult = await sql`
      SELECT get_or_create_cart(
        ${decoded.email}::VARCHAR,
        ${partnerId}::INTEGER,
        NULL::VARCHAR
      ) as cart_id
    `;

    const cartId = cartResult.rows[0].cart_id;

    // Get all cart items
    const itemsResult = await sql`
      SELECT id, odoo_product_id, product_image_url
      FROM cart_items
      WHERE cart_id = ${cartId}
    `;

    const items = itemsResult.rows;
    console.log(`📦 [SYNC-IMAGES] Found ${items.length} items in cart`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    // Update each item
    for (const item of items) {
      try {
        // Skip if already has image
        if (item.product_image_url && item.product_image_url !== '/placeholder-product.png') {
          console.log(`⏭️ [SYNC-IMAGES] Item ${item.id} already has image, skipping`);
          skipped++;
          continue;
        }

        // Fetch image from Odoo
        const products = await callOdooAsAdmin(
          'product.product',
          'search_read',
          [],
          {
            domain: [['id', '=', item.odoo_product_id]],
            fields: ['image_128'],
            limit: 1
          }
        );

        if (products && products.length > 0 && products[0].image_128) {
          const imageUrl = `data:image/png;base64,${products[0].image_128}`;

          await sql`
            UPDATE cart_items
            SET product_image_url = ${imageUrl}
            WHERE id = ${item.id}
          `;

          console.log(`✅ [SYNC-IMAGES] Updated image for item ${item.id}`);
          updated++;
        } else {
          console.log(`⚠️ [SYNC-IMAGES] No image available for product ${item.odoo_product_id}`);
          skipped++;
        }
      } catch (error: any) {
        console.error(`❌ [SYNC-IMAGES] Failed to update item ${item.id}:`, error.message);
        failed++;
      }
    }

    console.log(`🎉 [SYNC-IMAGES] Sync complete: ${updated} updated, ${skipped} skipped, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: 'Sincronizzazione immagini completata',
      stats: {
        total: items.length,
        updated,
        skipped,
        failed
      }
    });

  } catch (error: any) {
    console.error('💥 [SYNC-IMAGES] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}
