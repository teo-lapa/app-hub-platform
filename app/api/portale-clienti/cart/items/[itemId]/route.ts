import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * PATCH /api/portale-clienti/cart/items/[itemId]
 *
 * Modifica la quantità di un item nel carrello
 * - Params: itemId
 * - Body: { quantity: number }
 * - Update cart_items SET quantity = ... WHERE id = itemId
 * - Verifica che l'item appartenga al carrello del cliente autenticato
 *
 * Returns: { success: true, item: {...}, cart: {...} }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const itemId = params.itemId;
    console.log('🛒 [CART-ITEMS-API] PATCH - Modifica quantità item:', itemId);

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [CART-ITEMS-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per modificare il carrello' },
        { status: 401 }
      );
    }

    // Decode JWT
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [CART-ITEMS-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [CART-ITEMS-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { quantity } = body;

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'La quantità deve essere maggiore di zero' },
        { status: 400 }
      );
    }

    console.log('📦 [CART-ITEMS-API] Updating item quantity to:', quantity);

    // Get partner_id from Odoo
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [CART-ITEMS-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 401 }
      );
    }

    const partnerId = userPartners[0].id;

    // Verify item belongs to customer's cart
    const verifyResult = await sql`
      SELECT ci.id, ci.cart_id, ci.odoo_product_id, cc.customer_email
      FROM cart_items ci
      JOIN customer_carts cc ON cc.id = ci.cart_id
      WHERE ci.id = ${itemId}
        AND cc.customer_email = ${decoded.email}
        AND cc.status = 'active'
    `;

    if (verifyResult.rows.length === 0) {
      console.error('❌ [CART-ITEMS-API] Item not found or not owned by customer');
      return NextResponse.json(
        { success: false, error: 'Elemento del carrello non trovato' },
        { status: 404 }
      );
    }

    const item = verifyResult.rows[0];
    const productId = item.odoo_product_id;

    // Fetch product stock from Odoo to validate new quantity
    const products = await callOdooAsAdmin(
      'product.product',
      'search_read',
      [],
      {
        domain: [['id', '=', productId]],
        fields: ['qty_available'],
        limit: 1
      }
    );

    if (products && products.length > 0) {
      const availableStock = products[0].qty_available;
      if (availableStock < quantity) {
        return NextResponse.json(
          {
            success: false,
            error: 'Quantità richiesta non disponibile',
            availableQuantity: availableStock
          },
          { status: 409 }
        );
      }
    }

    // Update item quantity
    const updateResult = await sql`
      UPDATE cart_items
      SET
        quantity = ${quantity}::DECIMAL,
        updated_at = NOW()
      WHERE id = ${itemId}
      RETURNING
        id,
        cart_id,
        odoo_product_id as product_id,
        product_name,
        product_code,
        quantity,
        unit_price,
        subtotal,
        uom,
        available_stock,
        is_available
    `;

    const updatedItem = updateResult.rows[0];
    console.log('✅ [CART-ITEMS-API] Item quantity updated:', {
      itemId,
      newQuantity: quantity,
      newSubtotal: updatedItem.subtotal
    });

    // Get updated cart summary
    const summaryResult = await sql`
      SELECT get_cart_summary(${item.cart_id}::BIGINT) as summary
    `;

    const summary = summaryResult.rows[0].summary;

    return NextResponse.json({
      success: true,
      message: 'Quantità aggiornata',
      item: updatedItem,
      cart: summary.cart
    });

  } catch (error: any) {
    console.error('💥 [CART-ITEMS-API] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore nell\'aggiornamento della quantità' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portale-clienti/cart/items/[itemId]
 *
 * Rimuovi item dal carrello
 * - Params: itemId
 * - DELETE FROM cart_items WHERE id = itemId
 * - Trigger automatico aggiorna totali carrello
 * - Verifica che l'item appartenga al carrello del cliente autenticato
 *
 * Returns: { success: true, cart: {...} }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const itemId = params.itemId;
    console.log('🛒 [CART-ITEMS-API] DELETE - Rimuovi item:', itemId);

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [CART-ITEMS-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per modificare il carrello' },
        { status: 401 }
      );
    }

    // Decode JWT
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [CART-ITEMS-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [CART-ITEMS-API] JWT verification failed:', jwtError.message);
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
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [CART-ITEMS-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 401 }
      );
    }

    // Verify item belongs to customer's cart
    const verifyResult = await sql`
      SELECT ci.id, ci.cart_id, ci.product_name, cc.customer_email
      FROM cart_items ci
      JOIN customer_carts cc ON cc.id = ci.cart_id
      WHERE ci.id = ${itemId}
        AND cc.customer_email = ${decoded.email}
        AND cc.status = 'active'
    `;

    if (verifyResult.rows.length === 0) {
      console.error('❌ [CART-ITEMS-API] Item not found or not owned by customer');
      return NextResponse.json(
        { success: false, error: 'Elemento del carrello non trovato' },
        { status: 404 }
      );
    }

    const item = verifyResult.rows[0];
    const cartId = item.cart_id;

    // Delete item from cart
    await sql`
      DELETE FROM cart_items
      WHERE id = ${itemId}
    `;

    console.log('✅ [CART-ITEMS-API] Item deleted:', {
      itemId,
      productName: item.product_name
    });

    // Get updated cart summary (triggers automatically updated totals)
    const summaryResult = await sql`
      SELECT get_cart_summary(${cartId}::BIGINT) as summary
    `;

    const summary = summaryResult.rows[0].summary;

    return NextResponse.json({
      success: true,
      message: 'Prodotto rimosso dal carrello',
      cart: summary.cart,
      items: summary.items || []
    });

  } catch (error: any) {
    console.error('💥 [CART-ITEMS-API] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore nella rimozione del prodotto' },
      { status: 500 }
    );
  }
}
