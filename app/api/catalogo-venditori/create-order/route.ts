import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/create-order
 *
 * Creates a sale.order in Odoo from the cart for the seller catalog feature.
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
  notes?: string;
  deliveryDate?: string; // Format: YYYY-MM-DD
}

export async function POST(request: NextRequest) {
  try {
    console.log('📦 [CREATE-ORDER-API] POST - Starting order creation process');

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

    const { customerId, deliveryAddressId, orderLines, notes, deliveryDate } = body;

    console.log('📋 [CREATE-ORDER-API] Request data:', {
      customerId,
      deliveryAddressId,
      orderLinesCount: orderLines?.length,
      hasNotes: !!notes,
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
    const customerPartners = await callOdooAsAdmin(
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
      const deliveryAddresses = await callOdooAsAdmin(
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
      const products = await callOdooAsAdmin(
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
        return NextResponse.json(
          { success: false, error: `Product with ID ${line.product_id} not found` },
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
      note: notes || 'Ordine creato dal Catalogo Venditori',
    };

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

    const odooOrderId = await callOdooAsAdmin(
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
      };

      return callOdooAsAdmin(
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

    console.log('✅ [CREATE-ORDER-API] Order details:', {
      id: odooOrderId,
      name: orderName,
      total: createdOrder?.[0]?.amount_total,
      state: createdOrder?.[0]?.state
    });

    // Post notes to Chatter if provided
    if (notes && notes.trim()) {
      try {
        console.log('📝 [CREATE-ORDER-API] Posting notes to Chatter...');

        const notesMessage = `<p><strong>📝 Note Venditore</strong></p><p>${notes.replace(/\n/g, '<br/>')}</p><p><em>Note inserite dal venditore durante la creazione dell'ordine</em></p>`;

        await callOdooAsAdmin(
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

        console.log('✅ [CREATE-ORDER-API] Notes posted to Chatter');
      } catch (notesError: any) {
        console.error('❌ [CREATE-ORDER-API] Failed to post notes to Chatter:', notesError.message);
        // Continue anyway - notes are also in order.note field
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
