import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/deliveries
 *
 * Recupera la lista delle consegne (stock.picking) del cliente loggato da Odoo
 *
 * Query params:
 * - from: data inizio (YYYY-MM-DD)
 * - to: data fine (YYYY-MM-DD)
 * - state: filtro per stato (assigned, done, etc.)
 *
 * Returns: Array di consegne con dati completi e tracking GPS
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🚚 [DELIVERIES-API] Inizio recupero consegne cliente');

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [DELIVERIES-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare le consegne' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [DELIVERIES-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [DELIVERIES-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Estrai parametri query
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from') || '';
    const toDate = searchParams.get('to') || '';
    const stateFilter = searchParams.get('state') || '';

    console.log('📅 [DELIVERIES-API] Filtri:', { fromDate, toDate, stateFilter });

    // Step 1: Get partner_id using admin session
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [DELIVERIES-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 404 }
      );
    }

    const partnerId = userPartners[0].id;
    console.log('✅ [DELIVERIES-API] Cliente identificato:', partnerId);

    // Step 2: Costruisci domain per la ricerca consegne
    const domain: any[] = [
      ['partner_id', '=', partnerId],
      ['picking_type_code', '=', 'outgoing'], // Solo consegne in uscita
      ['state', 'in', ['assigned', 'done']], // Pronte o completate
    ];

    // Aggiungi filtro date se presenti
    if (fromDate) {
      domain.push(['scheduled_date', '>=', fromDate]);
    }
    if (toDate) {
      domain.push(['scheduled_date', '<=', toDate]);
    }

    // Aggiungi filtro stato specifico se richiesto
    if (stateFilter) {
      const stateIndex = domain.findIndex(d => d[0] === 'state');
      if (stateIndex >= 0) {
        domain.splice(stateIndex, 1);
      }
      domain.push(['state', '=', stateFilter]);
    }

    console.log('🔍 [DELIVERIES-API] Domain ricerca:', JSON.stringify(domain));

    // Step 3: Recupera le consegne da Odoo usando admin session
    const deliveries = await callOdooAsAdmin(
      'stock.picking',
      'search_read',
      [],
      {
        domain,
        fields: [
          'id',
          'name',
          'scheduled_date',
          'date_done',
          'state',
          'origin', // SO number
          'partner_id',
          'location_dest_id',
          'move_ids_without_package',
          'carrier_tracking_ref',
          // 'delivery_man_id', // REMOVED: Campo custom non presente su production
        ],
        order: 'scheduled_date desc',
        limit: 100,
      }
    );
    console.log(`✅ [DELIVERIES-API] Trovate ${deliveries.length} consegne`);

    // Step 4: Formatta i dati per il frontend
    const formattedDeliveries = deliveries.map((delivery: any) => ({
      id: delivery.id,
      name: delivery.name,
      scheduledDate: delivery.scheduled_date,
      dateDone: delivery.date_done,
      state: delivery.state,
      stateLabel: getDeliveryStateLabel(delivery.state),
      origin: delivery.origin, // SO number
      partnerId: delivery.partner_id?.[0] || partnerId,
      partnerName: delivery.partner_id?.[1] || '',
      locationDest: delivery.location_dest_id?.[1] || '',
      trackingRef: delivery.carrier_tracking_ref || null,
      // deliveryMan: delivery.delivery_man_id?.[1] || null, // REMOVED: Campo custom
      itemsCount: delivery.move_ids_without_package?.length || 0,
    }));

    return NextResponse.json({
      success: true,
      deliveries: formattedDeliveries,
      count: formattedDeliveries.length,
    });

  } catch (error: any) {
    console.error('❌ [DELIVERIES-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}

/**
 * Converti stato delivery in label italiano
 */
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
