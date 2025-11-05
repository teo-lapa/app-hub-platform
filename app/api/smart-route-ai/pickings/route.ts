import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { dateFrom, dateTo } = await request.json();

    console.log('[Smart Route AI] Caricamento picking WH/PICK...');
    console.log('[Smart Route AI] Date:', { dateFrom, dateTo });

    // Recupera session da cookie (usa odoo_session_id dal login)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'Nessuna sessione Odoo',
        pickings: [],
        withCoordinates: 0
      }, { status: 401 });
    }

    const odooSessionId = sessionCookie.value;

    // Crea client RPC con session ID
    const rpcClient = createOdooRPCClient(odooSessionId);

    // Test connessione
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Impossibile connettersi a Odoo');
    }

    console.log('[Smart Route AI] Connessione Odoo OK');

    // Search for WH/PICK pickings using RPC client searchRead
    const pickings = await rpcClient.searchRead(
      'stock.picking',
      [
        ['name', 'ilike', 'WH/PICK'],
        ['state', 'in', ['confirmed', 'assigned', 'waiting']],
        ['scheduled_date', '>=', `${dateFrom} 00:00:00`],
        ['scheduled_date', '<=', `${dateTo} 23:59:59`]
      ],
      [
        'id', 'name', 'partner_id',
        'scheduled_date', 'state', 'move_ids_without_package', 'batch_id'
      ],
      500,
      'scheduled_date'
    );

    // Collect all unique batch IDs to fetch vehicle/driver info
    const batchIdsSet = new Set(pickings.map((p: any) => p.batch_id?.[0]).filter(Boolean));
    const batchIds = Array.from(batchIdsSet);

    // Fetch batch info with vehicle and driver in bulk
    let batchesMap: Record<number, any> = {};
    if (batchIds.length > 0) {
      console.log(`[Smart Route AI] Caricamento ${batchIds.length} batch con veicoli/autisti...`);

      const batches = await rpcClient.callKw(
        'stock.picking.batch',
        'read',
        [batchIds, ['id', 'name', 'x_studio_auto_del_giro', 'x_studio_autista_del_giro']]
      );

      // Create map: batchId -> batch data
      for (const batch of batches) {
        batchesMap[batch.id] = batch;
      }

      console.log(`[Smart Route AI] Caricati ${batches.length} batch con info veicoli`);
    }

    console.log(`[Smart Route AI] Trovati ${pickings.length} picking WH/PICK`);

    // Collect all partner IDs to fetch in bulk (PATTERN da delivery/list)
    const partnerIdsSet = new Set(pickings.map((p: any) => p.partner_id?.[0]).filter(Boolean));
    const partnerIds = Array.from(partnerIdsSet);

    // Collect all move IDs to fetch in bulk
    const allMoveIds: number[] = [];

    for (const picking of pickings) {
      if (picking.move_ids_without_package && picking.move_ids_without_package.length > 0) {
        allMoveIds.push(...picking.move_ids_without_package);
      }
    }

    // Fetch all partners with coordinates in ONE bulk request (res.partner model)
    let partnersMap: Record<number, any> = {};
    if (partnerIds.length > 0) {
      console.log(`[Smart Route AI] Caricamento ${partnerIds.length} partner in bulk...`);

      const partners = await rpcClient.callKw(
        'res.partner',
        'read',
        [partnerIds, ['id', 'name', 'street', 'street2', 'city', 'zip', 'partner_latitude', 'partner_longitude']]
      );

      // Create map: partnerId -> partner data
      for (const partner of partners) {
        partnersMap[partner.id] = partner;
      }

      console.log(`[Smart Route AI] Caricati ${partners.length} partner con coordinate`);
    }

    // Fetch all moves in ONE bulk request using RPC client
    let movesMap: Record<number, number> = {};
    if (allMoveIds.length > 0) {
      console.log(`[Smart Route AI] Caricamento ${allMoveIds.length} move in bulk...`);

      const moves = await rpcClient.callKw(
        'stock.move',
        'read',
        [allMoveIds, ['id', 'product_uom_qty', 'picking_id']]
      );

      // Create map: pickingId -> total weight
      for (const move of moves) {
        const pickingId = move.picking_id ? move.picking_id[0] : null;
        if (pickingId) {
          if (!movesMap[pickingId]) {
            movesMap[pickingId] = 0;
          }
          movesMap[pickingId] += (move.product_uom_qty || 0);
        }
      }

      console.log(`[Smart Route AI] Calcolati pesi per ${Object.keys(movesMap).length} picking`);
    }

    const formattedPickings = [];
    let withCoordinates = 0;

    for (const picking of pickings) {
      const partnerId = picking.partner_id ? picking.partner_id[0] : null;
      const partner = partnerId ? partnersMap[partnerId] : null;

      // Only include pickings with coordinates (from partner data)
      if (partner && partner.partner_latitude && partner.partner_longitude) {
        withCoordinates++;
        const totalWeight = movesMap[picking.id] || 0;

        // Build address from partner data
        const addressParts = [
          partner.street,
          partner.street2,
          partner.zip,
          partner.city
        ].filter(Boolean);
        const address = addressParts.join(', ') || partner.name || 'Indirizzo sconosciuto';

        // Get batch info if exists
        const batchId = picking.batch_id ? picking.batch_id[0] : null;
        const batch = batchId ? batchesMap[batchId] : null;

        formattedPickings.push({
          id: picking.id,
          name: picking.name,
          partnerId: partnerId || 0,
          partnerName: partner.name || 'Sconosciuto',
          address: address,
          lat: partner.partner_latitude,
          lng: partner.partner_longitude,
          weight: totalWeight,
          scheduledDate: picking.scheduled_date,
          state: picking.state,
          batchId: batchId,
          batchName: picking.batch_id ? picking.batch_id[1] : null,
          batchVehicleName: batch?.x_studio_auto_del_giro ? batch.x_studio_auto_del_giro[1] : null,
          batchDriverName: batch?.x_studio_autista_del_giro ? batch.x_studio_autista_del_giro[1] : null
        });
      }
    }

    console.log(`[Smart Route AI] Restituiti ${formattedPickings.length} picking con coordinate`);

    return NextResponse.json({
      success: true,
      pickings: formattedPickings,
      withCoordinates
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Errore caricamento picking:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore caricamento picking',
      pickings: [],
      withCoordinates: 0
    }, { status: 500 });
  }
}
