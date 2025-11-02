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

    // Get cart items (including reservation data if present)
    const itemsResult = await sql`
      SELECT
        id,
        odoo_product_id,
        product_name,
        product_code,
        quantity,
        unit_price,
        subtotal,
        uom,
        is_reservation,
        reservation_text_note,
        reservation_audio_url,
        reservation_image_url,
        reservation_audio_odoo_attachment_id,
        reservation_image_odoo_attachment_id
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

    // Validate stock availability for non-reservation items only
    for (const item of cartItems) {
      // Skip stock validation for reservation items
      if (item.is_reservation) {
        console.log(`⏩ [CHECKOUT-API] Skipping stock check for reserved item: ${item.product_name}`);
        continue;
      }

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

    // Parse request body for delivery date
    let deliveryDate = null;
    try {
      const body = await request.json();
      deliveryDate = body.deliveryDate;
      console.log('📅 [CHECKOUT-API] Delivery date requested:', deliveryDate);
    } catch (e) {
      // No body or invalid JSON - use default
      console.log('⚠️ [CHECKOUT-API] No delivery date specified');
    }

    // Create sale.order in Odoo
    console.log('📝 [CHECKOUT-API] Creating sale.order in Odoo...');

    // Format dates for Odoo (YYYY-MM-DD HH:MM:SS)
    const formatDateForOdoo = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const orderData: any = {
      partner_id: partnerId,
      date_order: formatDateForOdoo(new Date()),
      state: 'draft',
      origin: `Portale Clienti - Cart #${cartId}`,
      note: cart.delivery_notes || 'Ordine creato dal Portale Clienti',
    };

    // Add commitment_date (requested delivery date) if specified
    if (deliveryDate) {
      try {
        const parsedDate = new Date(deliveryDate);
        orderData.commitment_date = formatDateForOdoo(parsedDate);
        console.log('✅ [CHECKOUT-API] Commitment date set:', orderData.commitment_date);
      } catch (dateError: any) {
        console.warn('⚠️ [CHECKOUT-API] Invalid delivery date format:', dateError.message);
      }
    }

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

    // Post reservation data to Odoo Chatter for each reserved item
    const reservedItems = cartItems.filter(item => item.is_reservation);

    if (reservedItems.length > 0) {
      console.log(`📝 [CHECKOUT-API] Processing ${reservedItems.length} reserved items for Chatter...`);

      for (const item of reservedItems) {
        try {
          // Build Chatter message body
          let messageBody = `<p><strong>🔔 Prenotazione Prodotto</strong></p>`;
          messageBody += `<p><strong>Prodotto:</strong> ${item.product_name} ${item.product_code ? `(${item.product_code})` : ''}</p>`;
          messageBody += `<p><strong>Quantità richiesta:</strong> ${item.quantity} ${item.uom}</p>`;

          if (item.reservation_text_note) {
            messageBody += `<p><strong>Note cliente:</strong><br/>${item.reservation_text_note.replace(/\n/g, '<br/>')}</p>`;
          }

          if (item.reservation_audio_url) {
            messageBody += `<p><strong>🎤 Registrazione audio:</strong> <a href="${item.reservation_audio_url}" target="_blank">Ascolta audio</a></p>`;
          }

          if (item.reservation_image_url) {
            messageBody += `<p><strong>📷 Foto prodotto:</strong> <a href="${item.reservation_image_url}" target="_blank">Visualizza foto</a></p>`;
          }

          messageBody += `<p><em>Richiesta inviata dal Portale Clienti</em></p>`;

          // Create message in Chatter
          const messageId = await callOdooAsAdmin(
            'mail.message',
            'create',
            [{
              model: 'sale.order',
              res_id: odooOrderId,
              body: messageBody,
              message_type: 'comment',
              subtype_id: 1, // mt_note (internal note)
            }],
            {}
          );

          console.log(`✅ [CHECKOUT-API] Chatter message created for ${item.product_name}, message ID: ${messageId}`);

          // If there are Odoo attachments, link them to the order
          const attachmentIds = [
            item.reservation_audio_odoo_attachment_id,
            item.reservation_image_odoo_attachment_id
          ].filter(id => id !== null);

          if (attachmentIds.length > 0) {
            for (const attachmentId of attachmentIds) {
              try {
                // Update attachment to link to sale.order instead of product.template
                await callOdooAsAdmin(
                  'ir.attachment',
                  'write',
                  [[attachmentId], {
                    res_model: 'sale.order',
                    res_id: odooOrderId
                  }],
                  {}
                );
                console.log(`✅ [CHECKOUT-API] Attachment ${attachmentId} linked to order ${odooOrderId}`);
              } catch (attachError: any) {
                console.warn(`⚠️ [CHECKOUT-API] Failed to link attachment ${attachmentId}:`, attachError.message);
              }
            }
          }
        } catch (chatterError: any) {
          console.error(`❌ [CHECKOUT-API] Failed to post reservation to Chatter for ${item.product_name}:`, chatterError.message);
          // Continue processing other items even if one fails
        }
      }

      console.log(`✅ [CHECKOUT-API] All reservation data posted to Chatter`);
    }

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
