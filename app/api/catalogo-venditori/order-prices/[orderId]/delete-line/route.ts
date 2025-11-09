import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * DELETE /api/catalogo-venditori/order-prices/[orderId]/delete-line
 *
 * Deletes a product line from an order in Odoo
 *
 * Body:
 * - lineId: number
 *
 * Returns success message
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

    // Parse request body
    const body = await request.json();
    const { lineId } = body;

    if (!lineId || typeof lineId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid lineId' },
        { status: 400 }
      );
    }

    console.log('🗑️ [DELETE-LINE-API] Deleting line from order:', {
      orderId,
      lineId
    });

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [DELETE-LINE-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Verify order exists and is in draft state
    console.log('🔍 [DELETE-LINE-API] Verifying order...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', orderId],
          ['company_id', '=', 1] // Only LAPA company orders
        ],
        fields: ['id', 'name', 'state'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      console.error('❌ [DELETE-LINE-API] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];

    if (order.state !== 'draft') {
      console.error('❌ [DELETE-LINE-API] Order is not in draft state:', order.state);
      return NextResponse.json(
        {
          success: false,
          error: `Order ${order.name} is already confirmed and cannot be modified`
        },
        { status: 409 }
      );
    }

    // Delete the order line from Odoo
    console.log('🗑️ [DELETE-LINE-API] Deleting line from Odoo...');
    await callOdoo(
      cookies,
      'sale.order.line',
      'unlink',
      [[lineId]]
    );

    console.log(`✅ [DELETE-LINE-API] Line ${lineId} deleted successfully`);

    return NextResponse.json({
      success: true,
      message: `Line deleted from order ${order.name}`
    });

  } catch (error: any) {
    console.error('💥 [DELETE-LINE-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error deleting line from order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
