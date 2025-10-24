import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/deliveries/[id]
 *
 * Recupera il dettaglio di una consegna specifica con prodotti e tracking GPS
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliveryId = parseInt(params.id);
    console.log(`🚚 [DELIVERY-DETAIL-API] Recupero dettaglio consegna ${deliveryId}`);

    // Ottieni session_id
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Step 1: Verifica che il cliente abbia accesso a questa consegna
    const userInfo = await getCurrentUserInfo(sessionId);
    if (!userInfo.success || !userInfo.partnerId) {
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 401 }
      );
    }

    // Step 2: Recupera la consegna
    const deliveryResult = await callOdoo(
      sessionId,
      'stock.picking',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', deliveryId],
          ['partner_id', '=', userInfo.partnerId], // Security check
        ],
        fields: [
          'id',
          'name',
          'scheduled_date',
          'date_done',
          'state',
          'origin',
          'partner_id',
          'location_dest_id',
          'move_ids_without_package',
          'carrier_tracking_ref',
          'delivery_man_id',
          'note',
        ],
        limit: 1,
      }
    );

    if (!deliveryResult.success || !deliveryResult.result || deliveryResult.result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Consegna non trovata' },
        { status: 404 }
      );
    }

    const delivery = deliveryResult.result[0];

    // Step 3: Recupera i prodotti della consegna (stock.move)
    let products = [];
    if (delivery.move_ids_without_package && delivery.move_ids_without_package.length > 0) {
      const movesResult = await callOdoo(
        sessionId,
        'stock.move',
        'search_read',
        [],
        {
          domain: [['id', 'in', delivery.move_ids_without_package]],
          fields: [
            'id',
            'product_id',
            'product_uom_qty',
            'quantity_done',
            'product_uom',
            'state',
          ],
        }
      );

      if (movesResult.success && movesResult.result) {
        products = movesResult.result.map((move: any) => ({
          id: move.id,
          productId: move.product_id?.[0],
          productName: move.product_id?.[1] || '',
          quantityOrdered: move.product_uom_qty || 0,
          quantityDone: move.quantity_done || 0,
          uom: move.product_uom?.[1] || 'Units',
          state: move.state,
        }));
      }
    }

    // Step 4: Recupera posizione GPS autista (se disponibile)
    let gpsPosition = null;
    if (delivery.delivery_man_id) {
      const deliveryManId = delivery.delivery_man_id[0];
      // Cerca posizione GPS dal custom model (se esiste)
      const gpsResult = await callOdoo(
        sessionId,
        'delivery.gps.position',
        'search_read',
        [],
        {
          domain: [
            ['delivery_man_id', '=', deliveryManId],
            ['picking_id', '=', deliveryId],
          ],
          fields: ['latitude', 'longitude', 'timestamp'],
          order: 'timestamp desc',
          limit: 1,
        }
      );

      if (gpsResult.success && gpsResult.result && gpsResult.result.length > 0) {
        const pos = gpsResult.result[0];
        gpsPosition = {
          lat: pos.latitude,
          lng: pos.longitude,
          timestamp: pos.timestamp,
        };
      }
    }

    // Step 5: Formatta risposta
    const formattedDelivery = {
      id: delivery.id,
      name: delivery.name,
      scheduledDate: delivery.scheduled_date,
      dateDone: delivery.date_done,
      state: delivery.state,
      stateLabel: getDeliveryStateLabel(delivery.state),
      origin: delivery.origin,
      partnerId: delivery.partner_id?.[0],
      partnerName: delivery.partner_id?.[1] || '',
      locationDest: delivery.location_dest_id?.[1] || '',
      trackingRef: delivery.carrier_tracking_ref || null,
      deliveryMan: delivery.delivery_man_id?.[1] || null,
      deliveryManId: delivery.delivery_man_id?.[0] || null,
      note: delivery.note || '',
      products,
      gpsPosition,
    };

    return NextResponse.json({
      success: true,
      delivery: formattedDelivery,
    });

  } catch (error: any) {
    console.error('❌ [DELIVERY-DETAIL-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}

async function getCurrentUserInfo(sessionId: string) {
  try {
    const userResult = await callOdoo(sessionId, 'res.users', 'search_read', [], {
      domain: [['id', '=', 'user_id']],
      fields: ['id', 'partner_id'],
      limit: 1,
    });

    if (!userResult.success || !userResult.result || userResult.result.length === 0) {
      return { success: false, partnerId: null };
    }

    const user = userResult.result[0];
    return {
      success: true,
      partnerId: user.partner_id?.[0] || null,
    };
  } catch (error) {
    return { success: false, partnerId: null };
  }
}

async function callOdoo(sessionId: string, model: string, method: string, args: any[], kwargs: any = {}) {
  try {
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs,
        },
        id: Math.floor(Math.random() * 1000000),
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.data?.message || data.error.message };
    }

    return { success: true, result: data.result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function getDeliveryStateLabel(state: string): string {
  const labels: Record<string, string> = {
    draft: 'Bozza',
    waiting: 'In Attesa',
    confirmed: 'Confermata',
    assigned: 'Pronta',
    done: 'Consegnata',
    cancel: 'Annullata',
  };
  return labels[state] || state;
}
