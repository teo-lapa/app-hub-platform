import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

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

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError: any) {
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Step 1: Get partner_id using admin session
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 404 }
      );
    }

    const partnerId = userPartners[0].id;

    // Step 2: Recupera la consegna usando admin session
    const deliveryResult = await callOdooAsAdmin(
      'stock.picking',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', deliveryId],
          ['partner_id', '=', partnerId], // Security check
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
          // 'delivery_man_id', // REMOVED: campo custom non presente su production
          'note',
        ],
        limit: 1,
      }
    );

    if (!deliveryResult || deliveryResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Consegna non trovata' },
        { status: 404 }
      );
    }

    const delivery = deliveryResult[0];

    // Step 2b: Recupera coordinate destinazione (partner)
    let destinationCoordinates = null;
    if (delivery.partner_id && delivery.partner_id[0]) {
      const partnerResult = await callOdooAsAdmin(
        'res.partner',
        'search_read',
        [],
        {
          domain: [['id', '=', delivery.partner_id[0]]],
          fields: ['partner_latitude', 'partner_longitude'],
          limit: 1,
        }
      );

      if (partnerResult && partnerResult.length > 0) {
        const partner = partnerResult[0];
        if (partner.partner_latitude && partner.partner_longitude) {
          destinationCoordinates = {
            lat: partner.partner_latitude,
            lng: partner.partner_longitude,
          };
        }
      }
    }

    // Step 3: Recupera i prodotti della consegna (stock.move)
    let products = [];
    if (delivery.move_ids_without_package && delivery.move_ids_without_package.length > 0) {
      const movesResult = await callOdooAsAdmin(
        'stock.move',
        'search_read',
        [],
        {
          domain: [['id', 'in', delivery.move_ids_without_package]],
          fields: [
            'id',
            'product_id',
            'product_uom_qty', // Quantità ordinata
            // 'quantity_done', // REMOVED: campo non esistente su Odoo standard
            'product_uom',
            'state',
          ],
        }
      );

      if (movesResult && movesResult.length > 0) {
        products = movesResult.map((move: any) => {
          const quantityOrdered = move.product_uom_qty || 0;
          // Se stato = done, quantità consegnata = quantità ordinata
          // Altrimenti 0 (non ancora consegnato)
          const quantityDone = move.state === 'done' ? quantityOrdered : 0;

          return {
            id: move.id,
            productId: move.product_id?.[0],
            productName: move.product_id?.[1] || '',
            quantityOrdered,
            quantityDone,
            uom: move.product_uom?.[1] || 'Units',
            state: move.state,
          };
        });
      }
    }

    // Step 4: Recupera posizione GPS autista (se disponibile)
    // TODO: Implementare tracking GPS in tempo reale quando disponibile
    let gpsPosition = null;

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
      // deliveryMan: delivery.delivery_man_id?.[1] || null, // REMOVED: campo custom
      // deliveryManId: delivery.delivery_man_id?.[0] || null, // REMOVED: campo custom
      note: delivery.note || '',
      products,
      gpsPosition, // Posizione autista (se disponibile)
      destinationCoordinates, // Coordinate destinazione cliente
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
