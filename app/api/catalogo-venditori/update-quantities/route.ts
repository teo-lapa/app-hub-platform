import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/update-quantities
 *
 * Updates quantities for order lines in Odoo
 *
 * Body:
 * - orderId: number
 * - updates: Array<{ lineId: number; quantity: number }>
 *
 * Returns updated order data
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, updates } = body;

    if (!orderId || !updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: orderId and updates array required' },
        { status: 400 }
      );
    }

    console.log(`📝 [UPDATE-QUANTITIES-API] Updating quantities for order ${orderId}:`, updates);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [UPDATE-QUANTITIES-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Verify order exists and is in draft state
    console.log('🔍 [UPDATE-QUANTITIES-API] Verifying order...');
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
      console.error('❌ [UPDATE-QUANTITIES-API] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];

    if (order.state !== 'draft') {
      console.error('❌ [UPDATE-QUANTITIES-API] Order is not in draft state:', order.state);
      return NextResponse.json(
        {
          success: false,
          error: `Order ${order.name} is already confirmed and cannot be modified`
        },
        { status: 409 }
      );
    }

    // Update each line quantity
    console.log(`📝 [UPDATE-QUANTITIES-API] Updating ${updates.length} line quantities...`);

    for (const update of updates) {
      const { lineId, quantity } = update;

      if (!lineId || quantity === undefined || quantity <= 0) {
        console.warn(`⚠️ [UPDATE-QUANTITIES-API] Skipping invalid update:`, update);
        continue;
      }

      try {
        await callOdoo(
          cookies,
          'sale.order.line',
          'write',
          [[lineId], { product_uom_qty: quantity }]
        );

        console.log(`✅ [UPDATE-QUANTITIES-API] Updated line ${lineId} quantity to ${quantity}`);
      } catch (error: any) {
        console.error(`❌ [UPDATE-QUANTITIES-API] Error updating line ${lineId}:`, error);
        throw new Error(`Failed to update quantity for line ${lineId}: ${error.message}`);
      }
    }

    console.log('✅ [UPDATE-QUANTITIES-API] All quantities updated successfully');

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} line quantities`,
      orderId,
      updatedLines: updates.length
    });

  } catch (error: any) {
    console.error('💥 [UPDATE-QUANTITIES-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error updating quantities',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
