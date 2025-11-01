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

    // Recupera session da cookie (STESSO pattern di /api/picking/batches)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'Nessuna sessione Odoo',
        pickings: [],
        withCoordinates: 0
      }, { status: 401 });
    }

    const sessionData = JSON.parse(sessionCookie.value);

    // Crea client RPC con session ID
    const rpcClient = createOdooRPCClient(sessionData.sessionId);

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
        'id', 'name', 'partner_id', 'partner_latitude', 'partner_longitude',
        'scheduled_date', 'state', 'move_ids_without_package'
      ],
      500,
      'scheduled_date'
    );

    console.log(`[Smart Route AI] Trovati ${pickings.length} picking WH/PICK`);

    // Collect all move IDs to fetch in bulk
    const allMoveIds: number[] = [];

    for (const picking of pickings) {
      if (picking.move_ids_without_package && picking.move_ids_without_package.length > 0) {
        allMoveIds.push(...picking.move_ids_without_package);
      }
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
      // Only include pickings with coordinates
      if (picking.partner_latitude && picking.partner_longitude) {
        withCoordinates++;
        const totalWeight = movesMap[picking.id] || 0;

        formattedPickings.push({
          id: picking.id,
          name: picking.name,
          partnerId: picking.partner_id ? picking.partner_id[0] : 0,
          partnerName: picking.partner_id ? picking.partner_id[1] : 'Sconosciuto',
          address: picking.partner_id ? picking.partner_id[1] : '',
          lat: picking.partner_latitude,
          lng: picking.partner_longitude,
          weight: totalWeight,
          scheduledDate: picking.scheduled_date,
          state: picking.state
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
