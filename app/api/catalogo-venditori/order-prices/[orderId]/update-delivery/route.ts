import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/catalogo-venditori/order-prices/[orderId]/update-delivery
 *
 * Updates the delivery date for an order
 *
 * Body:
 * - deliveryDate: string (YYYY-MM-DD format)
 *
 * Returns success confirmation
 */

interface RouteContext {
  params: {
    orderId: string;
  };
}

export async function PATCH(
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

    const body = await request.json();
    const { deliveryDate } = body;

    if (!deliveryDate) {
      return NextResponse.json(
        { success: false, error: 'Delivery date is required' },
        { status: 400 }
      );
    }

    console.log('📅 [UPDATE-DELIVERY] Updating delivery date:', {
      orderId,
      deliveryDate
    });

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [UPDATE-DELIVERY] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Update order delivery date
    const result = await callOdoo(
      cookies,
      'sale.order',
      'write',
      [[orderId], {
        commitment_date: deliveryDate
      }]
    );

    if (!result) {
      console.error('❌ [UPDATE-DELIVERY] Failed to update delivery date');
      return NextResponse.json(
        { success: false, error: 'Failed to update delivery date' },
        { status: 500 }
      );
    }

    console.log(`✅ [UPDATE-DELIVERY] Delivery date updated successfully for order ${orderId}`);

    return NextResponse.json({
      success: true,
      message: 'Data di consegna aggiornata'
    });

  } catch (error: any) {
    console.error('💥 [UPDATE-DELIVERY] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error updating delivery date',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
