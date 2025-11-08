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
 * 1. Update the batch with CUSTOM fields (x_studio_auto_del_giro, x_studio_autista_del_giro)
 * 2. These fields do NOT propagate to pickings - they stay only on the batch
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

    const updateData: any = {
      x_studio_auto_del_giro: vehicleId,  // Set vehicle (fleet.vehicle)
    };

    // For driver, we need to use employeeId which is the hr.employee ID
    if (employeeId) {
      updateData.x_studio_autista_del_giro = employeeId;  // Set driver (hr.employee)
      console.log(`[Smart Route AI] Setting x_studio_autista_del_giro (employee) to: ${employeeId}`);
    } else {
      console.log(`[Smart Route AI] Warning: No employeeId provided, only setting vehicle`);
    }

    console.log(`[Smart Route AI] Setting x_studio_auto_del_giro (vehicle) to: ${vehicleId}`);
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
