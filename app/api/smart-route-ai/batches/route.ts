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

    // Fetch batches in draft or done state for the date
    const batches = await rpcClient.searchRead(
      'stock.picking.batch',
      [
        ['state', 'in', ['draft', 'done']],
        ['scheduled_date', '>=', `${date} 00:00:00`],
        ['scheduled_date', '<=', `${date} 23:59:59`]
      ],
      ['id', 'name', 'state', 'scheduled_date', 'picking_ids', 'user_id'],
      100,
      'name'
    );

    console.log(`[Smart Route AI] Found ${batches.length} batches`);

    return NextResponse.json({
      success: true,
      batches: batches.map((b: any) => ({
        id: b.id,
        name: b.name,
        state: b.state,
        scheduledDate: b.scheduled_date,
        pickingIds: b.picking_ids || [],
        userId: b.user_id ? b.user_id[0] : null,
        userName: b.user_id ? b.user_id[1] : null
      }))
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
