import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/catalogo-venditori/order-prices/[orderId]/cancel
 *
 * Cancels a sale order
 *
 * Returns success confirmation
 */

interface RouteContext {
  params: {
    orderId: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const orderId = parseInt(params.orderId);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    console.log('❌ [CANCEL-ORDER] Cancelling order:', orderId);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CANCEL-ORDER] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Verify order exists and get current state
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', orderId],
          ['company_id', '=', 1]
        ],
        fields: ['id', 'name', 'state'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      console.error('❌ [CANCEL-ORDER] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];

    // Only allow cancelling if order is in draft or sale state
    if (!['draft', 'sent', 'sale'].includes(order.state)) {
      console.error('❌ [CANCEL-ORDER] Cannot cancel order in state:', order.state);
      return NextResponse.json(
        { success: false, error: `Cannot cancel order in state: ${order.state}` },
        { status: 400 }
      );
    }

    // Call Odoo action_cancel method
    const result = await callOdoo(
      cookies,
      'sale.order',
      'action_cancel',
      [[orderId]]
    );

    if (!result) {
      console.error('❌ [CANCEL-ORDER] Failed to cancel order');
      return NextResponse.json(
        { success: false, error: 'Failed to cancel order' },
        { status: 500 }
      );
    }

    console.log(`✅ [CANCEL-ORDER] Order ${order.name} cancelled successfully`);

    return NextResponse.json({
      success: true,
      message: `Ordine ${order.name} annullato`
    });

  } catch (error: any) {
    console.error('💥 [CANCEL-ORDER] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error cancelling order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
