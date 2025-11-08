import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/confirm-order
 *
 * Confirms a sale order in Odoo, changing state from 'draft' to 'sale'.
 * Posts a confirmation message to the chatter.
 *
 * Request Body:
 * - orderId: number - The Odoo sale.order ID
 *
 * Returns: { success: true, orderName: string, state: string }
 */

interface ConfirmOrderRequest {
  orderId: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log('✅ [CONFIRM-ORDER-API] POST - Starting order confirmation process');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CONFIRM-ORDER-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    console.log('✅ [CONFIRM-ORDER-API] User authenticated, UID:', uid);

    // Parse request body
    let body: ConfirmOrderRequest;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('❌ [CONFIRM-ORDER-API] Invalid JSON body:', parseError.message);
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { orderId } = body;

    console.log('📋 [CONFIRM-ORDER-API] Request data:', { orderId });

    // Validate input
    if (!orderId || typeof orderId !== 'number') {
      console.error('❌ [CONFIRM-ORDER-API] Invalid orderId:', orderId);
      return NextResponse.json(
        { success: false, error: 'orderId is required and must be a number' },
        { status: 400 }
      );
    }

    // Fetch order from Odoo
    console.log('🔍 [CONFIRM-ORDER-API] Fetching order from Odoo...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: ['id', 'name', 'state', 'amount_total', 'partner_id'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      console.error('❌ [CONFIRM-ORDER-API] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];

    console.log('✅ [CONFIRM-ORDER-API] Order found:', {
      id: order.id,
      name: order.name,
      state: order.state
    });

    // Check if order is in draft state
    if (order.state !== 'draft') {
      console.error('❌ [CONFIRM-ORDER-API] Order is not in draft state:', order.state);
      return NextResponse.json(
        {
          success: false,
          error: `Order ${order.name} is already in state '${order.state}' and cannot be confirmed`,
          state: order.state
        },
        { status: 409 }
      );
    }

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
        console.log('✅ [CONFIRM-ORDER-API] User name retrieved:', userName);
      }
    } catch (userError: any) {
      console.error('⚠️ [CONFIRM-ORDER-API] Could not fetch user name:', userError.message);
      // Continue with default name
    }

    // Confirm order using action_confirm method
    console.log('📝 [CONFIRM-ORDER-API] Confirming order in Odoo...');

    try {
      await callOdoo(
        cookies,
        'sale.order',
        'action_confirm',
        [[orderId]],
        {}
      );
      console.log('✅ [CONFIRM-ORDER-API] Order confirmed successfully');
    } catch (confirmError: any) {
      console.error('❌ [CONFIRM-ORDER-API] Failed to confirm order:', confirmError.message);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to confirm order: ${confirmError.message}`
        },
        { status: 500 }
      );
    }

    // Post confirmation message to chatter
    try {
      console.log('📝 [CONFIRM-ORDER-API] Posting confirmation message to Chatter...');

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

      const confirmationMessage = `<p><strong>✅ Prezzi confermati e ordine finalizzato</strong></p><ul><li><strong>Confermato da:</strong> ${userName}</li><li><strong>Data/Ora:</strong> ${formattedDate} ${formattedTime}</li><li><strong>Importo totale:</strong> CHF ${order.amount_total.toFixed(2)}</li></ul><p><em>Ordine confermato da Catalogo Venditori AI</em></p>`;

      await callOdoo(
        cookies,
        'mail.message',
        'create',
        [{
          model: 'sale.order',
          res_id: orderId,
          body: confirmationMessage,
          message_type: 'comment',
          subtype_id: 1, // mt_note (internal note)
        }],
        {}
      );

      console.log('✅ [CONFIRM-ORDER-API] Confirmation message posted to Chatter');
    } catch (chatterError: any) {
      console.error('⚠️ [CONFIRM-ORDER-API] Failed to post to Chatter:', chatterError.message);
      // Continue anyway - order is already confirmed
    }

    // Fetch updated order state
    console.log('🔍 [CONFIRM-ORDER-API] Fetching updated order state...');
    const confirmedOrders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: ['id', 'name', 'state'],
        limit: 1
      }
    );

    const confirmedOrder = confirmedOrders[0];

    console.log('✅ [CONFIRM-ORDER-API] Order confirmation completed:', {
      id: confirmedOrder.id,
      name: confirmedOrder.name,
      state: confirmedOrder.state
    });

    return NextResponse.json({
      success: true,
      message: 'Order confirmed successfully',
      orderId: confirmedOrder.id,
      orderName: confirmedOrder.name,
      state: confirmedOrder.state
    });

  } catch (error: any) {
    console.error('💥 [CONFIRM-ORDER-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error confirming order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
