import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { dateFrom, dateTo } = await request.json();

    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato'
      }, { status: 401 });
    }

    // Search for stock.picking (WH/PICK only - more specific filter)
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/stock.picking/search_read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.picking',
          method: 'search_read',
          args: [[
            ['name', 'like', 'WH/PICK'],
            ['state', 'in', ['confirmed', 'assigned', 'waiting']],
            ['scheduled_date', '>=', dateFrom + ' 00:00:00'],
            ['scheduled_date', '<=', dateTo + ' 23:59:59']
          ]],
          kwargs: {
            fields: [
              'id', 'name', 'partner_id', 'partner_latitude', 'partner_longitude',
              'scheduled_date', 'state', 'move_ids_without_package'
            ],
            limit: 500
          }
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.data?.message || 'Errore Odoo');
    }

    // Collect all move IDs to fetch in bulk (optimization: avoid N+1 queries)
    const allMoveIds: number[] = [];

    for (const picking of (data.result || [])) {
      if (picking.move_ids_without_package && picking.move_ids_without_package.length > 0) {
        allMoveIds.push(...picking.move_ids_without_package);
      }
    }

    // Fetch all moves in ONE single request (bulk operation)
    let movesMap: Record<number, number> = {};
    if (allMoveIds.length > 0) {
      const movesResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw/stock.move/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.move',
            method: 'read',
            args: [allMoveIds, ['id', 'product_uom_qty', 'picking_id']],
            kwargs: {}
          },
          id: Date.now(),
        }),
      });

      if (movesResponse.ok) {
        const movesData = await movesResponse.json();
        if (movesData.result) {
          // Create map: pickingId -> total weight
          for (const move of movesData.result) {
            const pickingId = move.picking_id ? move.picking_id[0] : null;
            if (pickingId) {
              if (!movesMap[pickingId]) {
                movesMap[pickingId] = 0;
              }
              movesMap[pickingId] += (move.product_uom_qty || 0);
            }
          }
        }
      }
    }

    const pickings = [];
    let withCoordinates = 0;

    for (const picking of (data.result || [])) {
      // Only include pickings with coordinates
      if (picking.partner_latitude && picking.partner_longitude) {
        withCoordinates++;
        const totalWeight = movesMap[picking.id] || 0;

        pickings.push({
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

    return NextResponse.json({
      success: true,
      pickings,
      withCoordinates
    });

  } catch (error: any) {
    console.error('Error fetching pickings:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore caricamento picking',
      pickings: [],
      withCoordinates: 0
    }, { status: 500 });
  }
}
