import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/catalogo-venditori/add-order-line
 *
 * Adds a new product line to an existing sale.order
 * Used for adding urgent/offer products from review-prices page
 */

interface AddOrderLineRequest {
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  price?: number;
  source?: 'offer' | 'urgent';
}

export async function POST(request: NextRequest) {
  try {
    console.log('➕ [ADD-ORDER-LINE-API] POST - Adding line to existing order');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [ADD-ORDER-LINE-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    console.log('✅ [ADD-ORDER-LINE-API] User authenticated, UID:', uid);

    // Parse request body
    let body: AddOrderLineRequest;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('❌ [ADD-ORDER-LINE-API] Invalid JSON body:', parseError.message);
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { orderId, productId, productName, quantity, price, source } = body;

    console.log('📋 [ADD-ORDER-LINE-API] Request data:', {
      orderId,
      productId,
      productName,
      quantity,
      price,
      source
    });

    // Validate input
    if (!orderId || typeof orderId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'orderId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!productId || typeof productId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'productId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'quantity must be a positive number' },
        { status: 400 }
      );
    }

    // Verify order exists and is in draft/sent state
    console.log('🔍 [ADD-ORDER-LINE-API] Verifying order...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', orderId],
          ['state', 'in', ['draft', 'sent']]
        ],
        fields: ['id', 'name', 'state'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      console.error('❌ [ADD-ORDER-LINE-API] Order not found or not editable:', orderId);
      return NextResponse.json(
        { success: false, error: 'Ordine non trovato o non modificabile' },
        { status: 404 }
      );
    }

    const order = orders[0];
    console.log('✅ [ADD-ORDER-LINE-API] Order verified:', order.name, order.state);

    // Verify product exists
    console.log('🔍 [ADD-ORDER-LINE-API] Verifying product...');
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', productId],
          ['sale_ok', '=', true],
          ['active', '=', true]
        ],
        fields: ['id', 'name', 'default_code'],
        limit: 1
      }
    );

    if (!products || products.length === 0) {
      console.error('❌ [ADD-ORDER-LINE-API] Product not found or not available:', productId);
      return NextResponse.json(
        { success: false, error: `Prodotto "${productName}" non disponibile` },
        { status: 404 }
      );
    }

    const product = products[0];
    console.log('✅ [ADD-ORDER-LINE-API] Product verified:', product.name);

    // Create order line
    console.log('📝 [ADD-ORDER-LINE-API] Creating order line...');
    const lineData: any = {
      order_id: orderId,
      product_id: productId,
      product_uom_qty: quantity,
      company_id: 1, // LAPA - finest italian food GmbH
    };

    // Add custom price if provided
    if (price !== undefined && price !== null) {
      lineData.price_unit = price;
      console.log(`✅ [ADD-ORDER-LINE-API] Using custom price: CHF ${price.toFixed(2)}${source ? ` (from ${source})` : ''}`);
    }

    // Add badge for offer/urgent products
    if (source) {
      const badge = source === 'offer' ? '🏷️ OFFERTA' : '🔔 URGENTE';
      lineData.name = `${badge} - ${productName}`;
      console.log(`✅ [ADD-ORDER-LINE-API] Added ${badge} badge to product name`);
    }

    const orderLineId = await callOdoo(
      cookies,
      'sale.order.line',
      'create',
      [lineData],
      {}
    );

    console.log('✅ [ADD-ORDER-LINE-API] Order line created:', orderLineId);

    // Add chatter message about the addition
    if (source) {
      try {
        const messageType = source === 'offer' ? 'offerta' : 'urgente';
        const priceInfo = price ? ` al prezzo di CHF ${price.toFixed(2)}` : '';

        await callOdoo(
          cookies,
          'sale.order',
          'message_post',
          [[orderId]],
          {
            body: `<p>➕ <strong>Prodotto aggiunto da ${messageType}</strong></p>
                   <p>📦 <strong>${productName}</strong></p>
                   <p>🔢 Quantità: ${quantity}${priceInfo}</p>
                   <p><em>Aggiunto durante la revisione prezzi</em></p>`,
            message_type: 'comment'
          }
        );

        console.log('✅ [ADD-ORDER-LINE-API] Chatter message added');
      } catch (error) {
        console.error('⚠️ [ADD-ORDER-LINE-API] Failed to add chatter message:', error);
        // Non bloccare l'operazione se fallisce il messaggio
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Prodotto aggiunto all\'ordine con successo',
      orderLineId: orderLineId
    });

  } catch (error: any) {
    console.error('❌ [ADD-ORDER-LINE-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante l\'aggiunta del prodotto'
      },
      { status: 500 }
    );
  }
}
