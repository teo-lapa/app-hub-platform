import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/smart-route-ai/batches/update-state
 * Update batch state: draft -> in_progress -> done
 *
 * Body: {
 *   batchId: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();

    if (!batchId) {
      return NextResponse.json({
        success: false,
        error: 'batchId required'
      }, { status: 400 });
    }

    console.log(`[Smart Route AI] Advancing state for batch ${batchId}`);

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

    // First read the current state
    const batches = await rpcClient.callKw(
      'stock.picking.batch',
      'read',
      [[batchId], ['id', 'name', 'state']]
    );

    if (!batches || batches.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found'
      }, { status: 404 });
    }

    const batch = batches[0];
    const currentState = batch.state;

    console.log(`[Smart Route AI] Current batch state: ${currentState}`);

    // Determine next state and action
    let newState: string;
    let actionMethod: string | null = null;

    if (currentState === 'draft') {
      // draft -> in_progress (call action_confirm method to start batch)
      newState = 'in_progress';
      actionMethod = 'action_confirm';
    } else if (currentState === 'in_progress') {
      // in_progress -> done (call action_done method to complete batch)
      newState = 'done';
      actionMethod = 'action_done';
    } else {
      return NextResponse.json({
        success: false,
        error: `Cannot advance from state: ${currentState}`,
        currentState
      }, { status: 400 });
    }

    console.log(`[Smart Route AI] Advancing from ${currentState} to ${newState} using method: ${actionMethod}`);

    // Call the action method to transition state
    if (actionMethod) {
      await rpcClient.callKw(
        'stock.picking.batch',
        actionMethod,
        [[batchId]]
      );
    }

    console.log(`[Smart Route AI] Successfully advanced batch ${batchId} to ${newState}`);

    return NextResponse.json({
      success: true,
      message: `Batch state updated to ${newState}`,
      newState
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Error updating batch state:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error updating batch state'
    }, { status: 500 });
  }
}
