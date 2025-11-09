import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/update-prices
 *
 * Updates prices and discounts for order lines.
 * Only works on draft orders.
 *
 * Request Body:
 * - orderId: number - The Odoo sale.order ID
 * - updates: Array<{
 *     lineId: number,
 *     priceUnit?: number,
 *     discount?: number
 *   }>
 *
 * Returns: { success: true, updatedLines: number }
 */

interface PriceUpdate {
  lineId: number;
  priceUnit?: number;
  discount?: number;
}

interface UpdatePricesRequest {
  orderId: number;
  updates: PriceUpdate[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('💰 [UPDATE-PRICES-API] POST - Starting price update process');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [UPDATE-PRICES-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    console.log('✅ [UPDATE-PRICES-API] User authenticated, UID:', uid);

    // Parse request body
    let body: UpdatePricesRequest;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('❌ [UPDATE-PRICES-API] Invalid JSON body:', parseError.message);
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { orderId, updates } = body;

    console.log('📋 [UPDATE-PRICES-API] Request data:', {
      orderId,
      updatesCount: updates?.length
    });

    // Validate input
    if (!orderId || typeof orderId !== 'number') {
      console.error('❌ [UPDATE-PRICES-API] Invalid orderId:', orderId);
      return NextResponse.json(
        { success: false, error: 'orderId is required and must be a number' },
        { status: 400 }
      );
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      console.error('❌ [UPDATE-PRICES-API] Invalid updates:', updates);
      return NextResponse.json(
        { success: false, error: 'updates must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each update
    for (const update of updates) {
      if (!update.lineId || typeof update.lineId !== 'number') {
        console.error('❌ [UPDATE-PRICES-API] Invalid lineId in update:', update);
        return NextResponse.json(
          { success: false, error: 'Each update must have a valid lineId (number)' },
          { status: 400 }
        );
      }

      if (update.priceUnit !== undefined) {
        if (typeof update.priceUnit !== 'number' || update.priceUnit < 0) {
          console.error('❌ [UPDATE-PRICES-API] Invalid priceUnit in update:', update);
          return NextResponse.json(
            { success: false, error: 'priceUnit must be a non-negative number' },
            { status: 400 }
          );
        }
      }

      if (update.discount !== undefined) {
        if (typeof update.discount !== 'number' || update.discount < 0 || update.discount > 100) {
          console.error('❌ [UPDATE-PRICES-API] Invalid discount in update:', update);
          return NextResponse.json(
            { success: false, error: 'discount must be a number between 0 and 100' },
            { status: 400 }
          );
        }
      }
    }

    console.log('✅ [UPDATE-PRICES-API] Input validation passed');

    // Verify order exists and is in draft state
    console.log('🔍 [UPDATE-PRICES-API] Verifying order state...');
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
      console.error('❌ [UPDATE-PRICES-API] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];

    if (order.state !== 'draft') {
      console.error('❌ [UPDATE-PRICES-API] Order is not in draft state:', order.state);
      return NextResponse.json(
        {
          success: false,
          error: `Order ${order.name} is already confirmed and cannot be edited`,
          state: order.state
        },
        { status: 409 }
      );
    }

    console.log('✅ [UPDATE-PRICES-API] Order is in draft state, proceeding with updates');

    // Update each line
    console.log('💾 [UPDATE-PRICES-API] Updating order lines...');
    let updatedCount = 0;

    for (const update of updates) {
      const updateData: any = {};

      if (update.priceUnit !== undefined) {
        updateData.price_unit = update.priceUnit;
      }

      if (update.discount !== undefined) {
        updateData.discount = update.discount;
      }

      if (Object.keys(updateData).length === 0) {
        console.log('⚠️ [UPDATE-PRICES-API] No changes for line:', update.lineId);
        continue;
      }

      try {
        await callOdoo(
          cookies,
          'sale.order.line',
          'write',
          [[update.lineId], updateData],
          {}
        );

        console.log('✅ [UPDATE-PRICES-API] Updated line:', update.lineId, updateData);
        updatedCount++;
      } catch (lineError: any) {
        console.error('❌ [UPDATE-PRICES-API] Failed to update line:', update.lineId, lineError.message);
        // Continue with other lines
      }
    }

    // Fetch updated order totals
    console.log('🔍 [UPDATE-PRICES-API] Fetching updated order totals...');
    const updatedOrders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: ['amount_total', 'amount_untaxed'],
        limit: 1
      }
    );

    const newTotals = updatedOrders[0];

    console.log('✅ [UPDATE-PRICES-API] Price update completed:', {
      updatedLines: updatedCount,
      newTotal: newTotals.amount_total
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} order lines`,
      updatedLines: updatedCount,
      newTotals: {
        subtotal: newTotals.amount_untaxed,
        total: newTotals.amount_total
      }
    });

  } catch (error: any) {
    console.error('💥 [UPDATE-PRICES-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error updating prices',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
