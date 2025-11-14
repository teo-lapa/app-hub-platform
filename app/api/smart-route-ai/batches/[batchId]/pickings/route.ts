import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/smart-route-ai/batches/[batchId]/pickings
 * Fetch all pickings with details for a specific batch
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const resolvedParams = await params;
    const batchId = parseInt(resolvedParams.batchId);

    if (isNaN(batchId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid batchId'
      }, { status: 400 });
    }

    console.log('[Smart Route AI] Fetching pickings for batch:', batchId);

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'No Odoo session',
        pickings: []
      }, { status: 401 });
    }

    const rpcClient = createOdooRPCClient(sessionCookie.value);

    // Test connection
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to Odoo');
    }

    // Fetch pickings for this batch
    const pickings = await rpcClient.searchRead(
      'stock.picking',
      [['batch_id', '=', batchId]],
      [
        'id',
        'name',
        'partner_id',
        'scheduled_date',
        'x_studio_indirizzo_completo',
        'x_studio_latitudine',
        'x_studio_longitudine',
        'move_ids_without_package',
        'state'
      ],
      1000,
      'scheduled_date'
    );

    console.log(`[Smart Route AI] Found ${pickings.length} pickings in batch ${batchId}`);

    // For each picking, get detailed move lines with products
    const pickingsWithDetails = await Promise.all(
      pickings.map(async (picking: any) => {
        let totalWeight = 0;
        let products: any[] = [];

        if (picking.move_ids_without_package && picking.move_ids_without_package.length > 0) {
          // Fetch move details
          const moves = await rpcClient.callKw(
            'stock.move',
            'read',
            [
              picking.move_ids_without_package,
              ['id', 'product_id', 'product_uom_qty', 'weight', 'product_uom']
            ]
          );

          totalWeight = moves.reduce((sum: number, move: any) => sum + (move.weight || 0), 0);

          products = moves.map((move: any) => ({
            id: move.id,
            productId: move.product_id ? move.product_id[0] : null,
            productName: move.product_id ? move.product_id[1] : 'Sconosciuto',
            quantity: move.product_uom_qty || 0,
            uom: move.product_uom ? move.product_uom[1] : '',
            weight: move.weight || 0
          }));
        }

        return {
          id: picking.id,
          name: picking.name,
          partnerId: picking.partner_id ? picking.partner_id[0] : null,
          partnerName: picking.partner_id ? picking.partner_id[1] : 'Cliente Sconosciuto',
          scheduledDate: picking.scheduled_date,
          address: picking.x_studio_indirizzo_completo || 'Indirizzo non disponibile',
          lat: picking.x_studio_latitudine || 0,
          lng: picking.x_studio_longitudine || 0,
          state: picking.state,
          weight: Math.round(totalWeight * 100) / 100,
          products: products
        };
      })
    );

    return NextResponse.json({
      success: true,
      pickings: pickingsWithDetails
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Error fetching batch pickings:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error fetching batch pickings',
      pickings: []
    }, { status: 500 });
  }
}
