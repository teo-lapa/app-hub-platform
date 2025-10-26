import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/portale-clienti/cart/checkout
 *
 * Conferma ordine e invia a Odoo
 * - Recupera cart completo dal DB
 * - Crea sale.order in Odoo via RPC con tutti i prodotti
 * - Update customer_carts SET status='converted', converted_to_order_id=..., converted_at=NOW()
 * - Log activity 'cart_converted'
 *
 * Returns: { success: true, orderId: number, odooOrderId: number, orderName: string }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🛒 [CHECKOUT-API] POST - Inizio processo checkout');

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [CHECKOUT-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per completare l\'ordine' },
        { status: 401 }
      );
    }

    // Decode JWT
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [CHECKOUT-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [CHECKOUT-API] JWT verification failed:', jwtError.message);
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
        fields: ['id', 'name', 'property_payment_term_id'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [CHECKOUT-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 401 }
      );
    }

    const partner = userPartners[0];
    const partnerId = partner.id;
    console.log('✅ [CHECKOUT-API] Cliente identificato:', partnerId);

    // Get active cart with items
    const cartResult = await sql`
      SELECT
        cc.id as cart_id,
        cc.customer_email,
        cc.odoo_partner_id,
        cc.item_count,
        cc.total_amount,
        cc.delivery_address_id,
        cc.delivery_notes
      FROM customer_carts cc
      WHERE cc.customer_email = ${decoded.email}
        AND cc.status = 'active'
        AND cc.odoo_partner_id = ${partnerId}
      ORDER BY cc.last_activity_at DESC
      LIMIT 1
    `;

    if (cartResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Carrello non trovato o vuoto' },
        { status: 404 }
      );
    }

    const cart = cartResult.rows[0];
    const cartId = cart.cart_id;

    // Validate cart has items
    if (cart.item_count === 0) {
      return NextResponse.json(
        { success: false, error: 'Il carrello è vuoto. Aggiungi prodotti prima di procedere.' },
        { status: 400 }
      );
    }

    console.log('✅ [CHECKOUT-API] Cart validated:', {
      cartId,
      itemCount: cart.item_count,
      total: cart.total_amount
    });

    // Get cart items
    const itemsResult = await sql`
      SELECT
        id,
        odoo_product_id,
        product_name,
        product_code,
        quantity,
        unit_price,
        subtotal,
        uom
      FROM cart_items
      WHERE cart_id = ${cartId}
      ORDER BY added_at DESC
    `;

    const cartItems = itemsResult.rows;

    if (cartItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessun prodotto nel carrello' },
        { status: 400 }
      );
    }

    console.log(`📦 [CHECKOUT-API] Found ${cartItems.length} items to convert to order`);

    // Validate stock availability for all items before creating order
    for (const item of cartItems) {
      const products = await callOdooAsAdmin(
        'product.product',
        'search_read',
        [],
        {
          domain: [['id', '=', item.odoo_product_id]],
          fields: ['qty_available', 'sale_ok', 'active'],
          limit: 1
        }
      );

      if (!products || products.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Prodotto ${item.product_name} non più disponibile`
          },
          { status: 409 }
        );
      }

      const product = products[0];

      if (!product.active || !product.sale_ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Prodotto ${item.product_name} non disponibile per la vendita`
          },
          { status: 409 }
        );
      }

      if (product.qty_available < parseFloat(item.quantity)) {
        return NextResponse.json(
          {
            success: false,
            error: `Quantità non disponibile per ${item.product_name}. Disponibili: ${product.qty_available}`,
            productId: item.odoo_product_id,
            availableQuantity: product.qty_available
          },
          { status: 409 }
        );
      }
    }

    console.log('✅ [CHECKOUT-API] All items validated for stock availability');

    // Create sale.order in Odoo
    console.log('📝 [CHECKOUT-API] Creating sale.order in Odoo...');

    const orderData: any = {
      partner_id: partnerId,
      date_order: new Date().toISOString(),
      state: 'draft',
      origin: `Portale Clienti - Cart #${cartId}`,
      note: cart.delivery_notes || 'Ordine creato dal Portale Clienti',
    };

    // Add payment term if available
    if (partner.property_payment_term_id) {
      orderData.payment_term_id = partner.property_payment_term_id[0];
    }

    // Add delivery address if specified
    if (cart.delivery_address_id) {
      orderData.partner_shipping_id = cart.delivery_address_id;
    }

    const odooOrderId = await callOdooAsAdmin(
      'sale.order',
      'create',
      [orderData],
      {}
    );

    console.log('✅ [CHECKOUT-API] Sale order created in Odoo:', odooOrderId);

    // Create order lines for each cart item
    console.log('📝 [CHECKOUT-API] Creating order lines...');

    const orderLinePromises = cartItems.map(async (item) => {
      const lineData = {
        order_id: odooOrderId,
        product_id: item.odoo_product_id,
        name: item.product_name,
        product_uom_qty: parseFloat(item.quantity),
        price_unit: parseFloat(item.unit_price),
      };

      return callOdooAsAdmin(
        'sale.order.line',
        'create',
        [lineData],
        {}
      );
    });

    await Promise.all(orderLinePromises);

    console.log(`✅ [CHECKOUT-API] Created ${cartItems.length} order lines`);

    // Confirm the order in Odoo (action_confirm)
    console.log('✅ [CHECKOUT-API] Confirming order in Odoo...');

    try {
      await callOdooAsAdmin(
        'sale.order',
        'action_confirm',
        [[odooOrderId]],
        {}
      );
      console.log('✅ [CHECKOUT-API] Order confirmed in Odoo');
    } catch (confirmError: any) {
      console.warn('⚠️ [CHECKOUT-API] Order confirmation warning:', confirmError.message);
      // Continue even if confirmation fails - order is created
    }

    // Fetch order name from Odoo
    const createdOrder = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', odooOrderId]],
        fields: ['name', 'amount_total', 'state'],
        limit: 1
      }
    );

    const orderName = createdOrder?.[0]?.name || `SO-${odooOrderId}`;

    console.log('✅ [CHECKOUT-API] Order details:', {
      id: odooOrderId,
      name: orderName,
      total: createdOrder?.[0]?.amount_total,
      state: createdOrder?.[0]?.state
    });

    // Update cart status to 'converted'
    await sql`
      UPDATE customer_carts
      SET
        status = 'converted',
        converted_to_order_id = ${odooOrderId},
        converted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${cartId}
    `;

    console.log('✅ [CHECKOUT-API] Cart marked as converted');

    // Log cart conversion activity
    await sql`
      INSERT INTO cart_activity_log (cart_id, event_type, event_data)
      VALUES (
        ${cartId},
        'cart_converted',
        ${JSON.stringify({
          odoo_order_id: odooOrderId,
          order_name: orderName,
          item_count: cart.item_count,
          total_amount: cart.total_amount,
          timestamp: new Date().toISOString()
        })}::jsonb
      )
    `;

    console.log('✅ [CHECKOUT-API] Cart conversion logged');

    return NextResponse.json({
      success: true,
      message: 'Ordine creato con successo',
      orderId: odooOrderId,
      orderName: orderName,
      total: createdOrder?.[0]?.amount_total || cart.total_amount,
      itemsCount: cart.item_count
    });

  } catch (error: any) {
    console.error('💥 [CHECKOUT-API] Error:', error);

    // Detailed error logging
    if (error.message) {
      console.error('💥 [CHECKOUT-API] Error message:', error.message);
    }
    if (error.stack) {
      console.error('💥 [CHECKOUT-API] Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nella creazione dell\'ordine',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
