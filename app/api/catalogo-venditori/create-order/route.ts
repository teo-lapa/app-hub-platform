import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/create-order
 *
 * Creates a sale.order in Odoo from the cart for the seller catalog feature.
 * Uses the logged-in user's session to track who created the order.
 *
 * Request Body:
 * - customerId: number - The Odoo partner ID of the customer
 * - deliveryAddressId: number | null - Optional delivery address (partner child address)
 * - orderLines: Array<{product_id: number, quantity: number}> - Products to order
 * - notes?: string - Optional order notes
 *
 * Returns: { success: true, orderId: number, orderName: string }
 */

interface OrderLine {
  product_id: number;
  quantity: number;
}

interface CreateOrderRequest {
  customerId: number;
  deliveryAddressId: number | null;
  orderLines: OrderLine[];
  orderNotes?: string; // Customer-visible notes (goes to order.note field)
  warehouseNotes?: string; // Internal notes (goes to Chatter)
  deliveryDate?: string; // Format: YYYY-MM-DD
}

export async function POST(request: NextRequest) {
  try {
    console.log('📦 [CREATE-ORDER-API] POST - Starting order creation process');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CREATE-ORDER-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    console.log('✅ [CREATE-ORDER-API] User authenticated, UID:', uid);

    // Parse request body
    let body: CreateOrderRequest;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('❌ [CREATE-ORDER-API] Invalid JSON body:', parseError.message);
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { customerId, deliveryAddressId, orderLines, orderNotes, warehouseNotes, deliveryDate } = body;

    console.log('📋 [CREATE-ORDER-API] Request data:', {
      customerId,
      deliveryAddressId,
      orderLinesCount: orderLines?.length,
      hasOrderNotes: !!orderNotes,
      hasWarehouseNotes: !!warehouseNotes,
      deliveryDate: deliveryDate || 'not specified'
    });

    // Validate input
    if (!customerId || typeof customerId !== 'number') {
      console.error('❌ [CREATE-ORDER-API] Invalid customerId:', customerId);
      return NextResponse.json(
        { success: false, error: 'customerId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!Array.isArray(orderLines) || orderLines.length === 0) {
      console.error('❌ [CREATE-ORDER-API] Invalid orderLines:', orderLines);
      return NextResponse.json(
        { success: false, error: 'orderLines must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each order line
    for (const line of orderLines) {
      if (!line.product_id || typeof line.product_id !== 'number') {
        console.error('❌ [CREATE-ORDER-API] Invalid product_id in order line:', line);
        return NextResponse.json(
          { success: false, error: 'Each order line must have a valid product_id (number)' },
          { status: 400 }
        );
      }

      if (!line.quantity || typeof line.quantity !== 'number' || line.quantity <= 0) {
        console.error('❌ [CREATE-ORDER-API] Invalid quantity in order line:', line);
        return NextResponse.json(
          { success: false, error: 'Each order line must have a valid quantity (positive number)' },
          { status: 400 }
        );
      }
    }

    console.log('✅ [CREATE-ORDER-API] Input validation passed');

    // Get customer partner from Odoo
    console.log('🔍 [CREATE-ORDER-API] Fetching customer partner...');
    const customerPartners = await callOdoo(
      cookies,
      'res.partner',
      'search_read',
      [],
      {
        domain: [['id', '=', customerId]],
        fields: ['id', 'name', 'email', 'property_payment_term_id', 'customer_rank'],
        limit: 1
      }
    );

    if (!customerPartners || customerPartners.length === 0) {
      console.error('❌ [CREATE-ORDER-API] Customer partner not found:', customerId);
      return NextResponse.json(
        { success: false, error: `Customer with ID ${customerId} not found` },
        { status: 404 }
      );
    }

    const customer = customerPartners[0];
    console.log('✅ [CREATE-ORDER-API] Customer found:', {
      id: customer.id,
      name: customer.name,
      email: customer.email
    });

    // Determine delivery address
    let shippingPartnerId = customerId;

    if (deliveryAddressId) {
      console.log('🔍 [CREATE-ORDER-API] Validating delivery address...');

      // Validate that delivery address exists and belongs to customer
      const deliveryAddresses = await callOdoo(
        cookies,
        'res.partner',
        'search_read',
        [],
        {
          domain: [
            ['id', '=', deliveryAddressId],
            ['parent_id', '=', customerId]
          ],
          fields: ['id', 'name', 'type'],
          limit: 1
        }
      );

      if (!deliveryAddresses || deliveryAddresses.length === 0) {
        console.error('❌ [CREATE-ORDER-API] Delivery address not found or does not belong to customer:', {
          deliveryAddressId,
          customerId
        });
        return NextResponse.json(
          { success: false, error: `Delivery address ${deliveryAddressId} not found or does not belong to customer` },
          { status: 404 }
        );
      }

      shippingPartnerId = deliveryAddressId;
      console.log('✅ [CREATE-ORDER-API] Delivery address validated:', deliveryAddresses[0].name);
    } else {
      console.log('ℹ️ [CREATE-ORDER-API] Using customer main address for delivery');
    }

    // Validate product availability
    console.log('🔍 [CREATE-ORDER-API] Validating product availability...');

    for (const line of orderLines) {
      const products = await callOdoo(
        cookies,
        'product.product',
        'search_read',
        [],
        {
          domain: [['id', '=', line.product_id]],
          fields: ['id', 'name', 'default_code', 'sale_ok', 'active', 'qty_available'],
          limit: 1
        }
      );

      if (!products || products.length === 0) {
        console.error('❌ [CREATE-ORDER-API] Product not found:', line.product_id);
        const productName = line.product_name || `ID ${line.product_id}`;
        return NextResponse.json(
          {
            success: false,
            error: `Il prodotto "${productName}" non è più disponibile in Odoo. Potrebbe essere stato archiviato o cancellato. Rimuovilo dal carrello e riprova.`,
            productId: line.product_id,
            productName: line.product_name
          },
          { status: 404 }
        );
      }

      const product = products[0];

      if (!product.active || !product.sale_ok) {
        console.error('❌ [CREATE-ORDER-API] Product not available for sale:', {
          id: product.id,
          name: product.name,
          active: product.active,
          sale_ok: product.sale_ok
        });
        return NextResponse.json(
          {
            success: false,
            error: `Product ${product.name} (${product.default_code || product.id}) is not available for sale`
          },
          { status: 409 }
        );
      }

      console.log('✅ [CREATE-ORDER-API] Product validated:', {
        id: product.id,
        name: product.name,
        code: product.default_code,
        quantity: line.quantity,
        available: product.qty_available
      });
    }

    console.log('✅ [CREATE-ORDER-API] All products validated');

    // Create sale.order in Odoo
    console.log('📝 [CREATE-ORDER-API] Creating sale.order in Odoo...');

    // Format date for Odoo (YYYY-MM-DD HH:MM:SS)
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
      partner_id: customerId,
      partner_shipping_id: shippingPartnerId,
      date_order: formatDateForOdoo(new Date()),
      state: 'draft',
      origin: 'Catalogo Venditori',
      company_id: 1, // LAPA - finest italian food GmbH
    };

    // Add order notes (customer-visible) to the note field
    if (orderNotes && orderNotes.trim()) {
      orderData.note = orderNotes.trim();
      console.log('✅ [CREATE-ORDER-API] Order notes added to note field');
    }

    // Add delivery date if provided (Odoo field: commitment_date or requested_date)
    if (deliveryDate) {
      // Format delivery date to YYYY-MM-DD (Odoo date field format)
      orderData.commitment_date = deliveryDate;
      console.log('✅ [CREATE-ORDER-API] Delivery date set:', deliveryDate);
    }

    // Add payment term if available
    if (customer.property_payment_term_id) {
      orderData.payment_term_id = customer.property_payment_term_id[0];
      console.log('✅ [CREATE-ORDER-API] Payment term added:', customer.property_payment_term_id[0]);
    }

    const odooOrderId = await callOdoo(
      cookies,
      'sale.order',
      'create',
      [orderData],
      {}
    );

    console.log('✅ [CREATE-ORDER-API] Sale order created in Odoo:', odooOrderId);

    // Create order lines
    console.log('📝 [CREATE-ORDER-API] Creating order lines...');

    const orderLinePromises = orderLines.map(async (line) => {
      const lineData = {
        order_id: odooOrderId,
        product_id: line.product_id,
        product_uom_qty: line.quantity,
        company_id: 1, // LAPA - finest italian food GmbH
      };

      return callOdoo(
        cookies,
        'sale.order.line',
        'create',
        [lineData],
        {}
      );
    });

    await Promise.all(orderLinePromises);

    console.log(`✅ [CREATE-ORDER-API] Created ${orderLines.length} order lines`);

    // Fetch order details from Odoo
    console.log('🔍 [CREATE-ORDER-API] Fetching order details...');
    const createdOrder = await callOdoo(
      cookies,
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

    console.log('✅ [CREATE-ORDER-API] Order details:', {
      id: odooOrderId,
      name: orderName,
      total: createdOrder?.[0]?.amount_total,
      state: createdOrder?.[0]?.state
    });

    // Get user name for chatter message
    let userName = 'Venditore';
    try {
      const users = await callOdoo(
        cookies,
        'res.users',
        'search_read',
        [],
        {
          domain: [['id', '=', uid]],
          fields: ['name'],
          limit: 1
        }
      );

      if (users && users.length > 0) {
        userName = users[0].name;
        console.log('✅ [CREATE-ORDER-API] User name retrieved:', userName);
      }
    } catch (userError: any) {
      console.error('⚠️ [CREATE-ORDER-API] Could not fetch user name:', userError.message);
      // Continue with default name
    }

    // Post automatic creation message to Chatter (ALWAYS)
    try {
      console.log('📝 [CREATE-ORDER-API] Posting creation message to Chatter...');

      const now = new Date();
      const formattedDate = now.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const formattedTime = now.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const creationMessage = `<p><strong>📱 Ordine inserito da Catalogo Venditori AI</strong></p><ul><li><strong>Venditore:</strong> ${userName}</li><li><strong>Data/Ora:</strong> ${formattedDate} ${formattedTime}</li><li><strong>Prodotti inseriti:</strong> ${orderLines.length}</li></ul>`;

      await callOdoo(
        cookies,
        'mail.message',
        'create',
        [{
          model: 'sale.order',
          res_id: odooOrderId,
          body: creationMessage,
          message_type: 'comment',
          subtype_id: 1, // mt_note (internal note)
        }],
        {}
      );

      console.log('✅ [CREATE-ORDER-API] Creation message posted to Chatter');
    } catch (chatterError: any) {
      console.error('⚠️ [CREATE-ORDER-API] Failed to post creation message to Chatter:', chatterError.message);
      // Continue anyway - not critical
    }

    // Post warehouse notes to Chatter if provided
    if (warehouseNotes && warehouseNotes.trim()) {
      try {
        console.log('📝 [CREATE-ORDER-API] Posting warehouse notes to Chatter...');

        const notesMessage = `<p><strong>📦 Note per il Magazzino</strong></p><p>${warehouseNotes.replace(/\n/g, '<br/>')}</p><p><em>Note interne inserite dal venditore</em></p>`;

        await callOdoo(
          cookies,
          'mail.message',
          'create',
          [{
            model: 'sale.order',
            res_id: odooOrderId,
            body: notesMessage,
            message_type: 'comment',
            subtype_id: 1, // mt_note (internal note)
          }],
          {}
        );

        console.log('✅ [CREATE-ORDER-API] Warehouse notes posted to Chatter');
      } catch (notesError: any) {
        console.error('❌ [CREATE-ORDER-API] Failed to post warehouse notes to Chatter:', notesError.message);
        // Continue anyway - not critical
      }
    }

    console.log('✅ [CREATE-ORDER-API] Order creation completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Order created successfully',
      orderId: odooOrderId,
      orderName: orderName,
      total: createdOrder?.[0]?.amount_total || 0,
      itemsCount: orderLines.length
    });

  } catch (error: any) {
    console.error('💥 [CREATE-ORDER-API] Error:', error);

    // Detailed error logging
    if (error.message) {
      console.error('💥 [CREATE-ORDER-API] Error message:', error.message);
    }
    if (error.stack) {
      console.error('💥 [CREATE-ORDER-API] Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error creating order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
