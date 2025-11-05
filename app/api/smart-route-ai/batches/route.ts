import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/smart-route-ai/batches?date=YYYY-MM-DD
 * Fetch all batches (draft + done) for a specific date
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({
        success: false,
        error: 'Date parameter required'
      }, { status: 400 });
    }

    console.log('[Smart Route AI] Fetching batches for date:', date);

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'No Odoo session',
        batches: []
      }, { status: 401 });
    }

    const rpcClient = createOdooRPCClient(sessionCookie.value);

    // Test connection
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to Odoo');
    }

    // Fetch batches in draft, in_progress or done state for the date
    const batches = await rpcClient.searchRead(
      'stock.picking.batch',
      [
        ['state', 'in', ['draft', 'in_progress', 'done']],
        ['scheduled_date', '>=', `${date} 00:00:00`],
        ['scheduled_date', '<=', `${date} 23:59:59`]
      ],
      ['id', 'name', 'state', 'scheduled_date', 'picking_ids', 'user_id', 'x_studio_auto_del_giro', 'x_studio_autista_del_giro'],
      100,
      'name'
    );

    console.log(`[Smart Route AI] Found ${batches.length} batches`);

    // Calculate total weight for each batch by summing picking weights
    const batchesWithWeights = await Promise.all(
      batches.map(async (b: any) => {
        let totalWeight = 0;

        if (b.picking_ids && b.picking_ids.length > 0) {
          // Fetch all pickings for this batch
          const pickings = await rpcClient.callKw(
            'stock.picking',
            'read',
            [b.picking_ids, ['id', 'move_ids_without_package']]
          );

          // Collect all move IDs
          const allMoveIds: number[] = [];
          for (const picking of pickings) {
            if (picking.move_ids_without_package && picking.move_ids_without_package.length > 0) {
              allMoveIds.push(...picking.move_ids_without_package);
            }
          }

          // Fetch weights from moves
          if (allMoveIds.length > 0) {
            const moves = await rpcClient.callKw(
              'stock.move',
              'read',
              [allMoveIds, ['id', 'product_uom_qty']]
            );

            totalWeight = moves.reduce((sum: number, move: any) => sum + (move.product_uom_qty || 0), 0);
          }
        }

        return {
          id: b.id,
          name: b.name,
          state: b.state,
          scheduledDate: b.scheduled_date,
          pickingIds: b.picking_ids || [],
          pickingCount: (b.picking_ids || []).length,
          userId: b.user_id ? b.user_id[0] : null,
          userName: b.user_id ? b.user_id[1] : null,
          vehicleName: b.x_studio_auto_del_giro ? b.x_studio_auto_del_giro[1] : null,
          driverName: b.x_studio_autista_del_giro ? b.x_studio_autista_del_giro[1] : null,
          totalWeight: Math.round(totalWeight)
        };
      })
    );

    return NextResponse.json({
      success: true,
      batches: batchesWithWeights
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Error fetching batches:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error fetching batches',
      batches: []
    }, { status: 500 });
  }
}

/**
 * POST /api/smart-route-ai/batches/move
 * Move a picking from one batch to another
 *
 * Body: {
 *   pickingId: number,
 *   targetBatchId: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { pickingId, targetBatchId } = await request.json();

    if (!pickingId || !targetBatchId) {
      return NextResponse.json({
        success: false,
        error: 'pickingId and targetBatchId required'
      }, { status: 400 });
    }

    console.log(`[Smart Route AI] Moving picking ${pickingId} to batch ${targetBatchId}`);

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'No Odoo session'
      }, { status: 401 });
    }

    const rpcClient = createOdooRPCClient(sessionCookie.value);

    // Test connection
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to Odoo');
    }

    // Update the picking's batch_id
    await rpcClient.callKw(
      'stock.picking',
      'write',
      [[pickingId], { batch_id: targetBatchId }]
    );

    console.log(`[Smart Route AI] Successfully moved picking ${pickingId} to batch ${targetBatchId}`);

    return NextResponse.json({
      success: true,
      message: 'Picking moved successfully'
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Error moving picking:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error moving picking'
    }, { status: 500 });
  }
}
