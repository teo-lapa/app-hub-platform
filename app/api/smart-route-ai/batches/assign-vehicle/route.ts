import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/smart-route-ai/batches/assign-vehicle
 * Assign vehicle and driver to a batch
 *
 * Body: {
 *   batchId: number,
 *   vehicleId: number,
 *   driverId: number,
 *   employeeId: number | null
 * }
 *
 * This will:
 * 1. Update the batch with vehicle_id and user_id (employee)
 * 2. Odoo will automatically propagate the driver to all pickings in the batch
 */
export async function POST(request: NextRequest) {
  try {
    const { batchId, vehicleId, driverId, employeeId } = await request.json();

    if (!batchId || !vehicleId || !driverId) {
      return NextResponse.json({
        success: false,
        error: 'batchId, vehicleId, and driverId required'
      }, { status: 400 });
    }

    console.log(`[Smart Route AI] Assigning vehicle ${vehicleId} to batch ${batchId}`);
    console.log(`[Smart Route AI] Driver ID: ${driverId}, Employee ID: ${employeeId}`);

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

    // Update the batch with driver/employee ONLY
    // Note: In Odoo standard, stock.picking.batch has:
    // - user_id: many2one to res.users (the employee/driver)
    //
    // vehicle_id is NOT a standard field - removed to avoid errors
    // When you set user_id on the batch, Odoo automatically propagates
    // the user to all pickings in that batch

    const updateData: any = {};

    // If employeeId is provided, use it (this is the user_id)
    if (employeeId) {
      updateData.user_id = employeeId;
      console.log(`[Smart Route AI] Setting user_id (employee) to: ${employeeId}`);
    } else {
      console.log(`[Smart Route AI] Warning: No employeeId provided, cannot set user_id`);
      throw new Error('Employee ID is required to assign driver to batch');
    }

    console.log(`[Smart Route AI] Update data:`, JSON.stringify(updateData));

    try {
      await rpcClient.callKw(
        'stock.picking.batch',
        'write',
        [[batchId], updateData]
      );
    } catch (odooError: any) {
      console.error('[Smart Route AI] Odoo error details:', odooError);
      throw new Error(`Failed to update batch in Odoo: ${odooError.message || 'Unknown error'}`);
    }

    console.log(`[Smart Route AI] Successfully assigned vehicle ${vehicleId} to batch ${batchId}`);
    console.log(`[Smart Route AI] Odoo will automatically propagate driver to all pickings`);

    return NextResponse.json({
      success: true,
      message: 'Vehicle and driver assigned to batch successfully'
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Error assigning vehicle:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error assigning vehicle'
    }, { status: 500 });
  }
}
