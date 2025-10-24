import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

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

    // Ottieni session_id dell'utente loggato
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ [DELIVERIES-API] Utente non loggato');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare le consegne' },
        { status: 401 }
      );
    }

    // Estrai parametri query
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from') || '';
    const toDate = searchParams.get('to') || '';
    const stateFilter = searchParams.get('state') || '';

    console.log('📅 [DELIVERIES-API] Filtri:', { fromDate, toDate, stateFilter });

    // Step 1: Ottieni l'utente corrente per recuperare il partner_id
    const userInfo = await getCurrentUserInfo(sessionId);

    if (!userInfo.success || !userInfo.partnerId) {
      console.error('❌ [DELIVERIES-API] Impossibile identificare il cliente');
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato. Rieffettua il login.' },
        { status: 401 }
      );
    }

    const partnerId = userInfo.partnerId;
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

    // Step 3: Recupera le consegne da Odoo
    const deliveriesResult = await callOdoo(
      sessionId,
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
          'delivery_man_id', // Autista
        ],
        order: 'scheduled_date desc',
        limit: 100,
      }
    );

    if (!deliveriesResult.success) {
      console.error('❌ [DELIVERIES-API] Errore recupero consegne:', deliveriesResult.error);
      return NextResponse.json(
        { success: false, error: 'Errore durante il recupero delle consegne' },
        { status: 500 }
      );
    }

    const deliveries = deliveriesResult.result || [];
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
      deliveryMan: delivery.delivery_man_id?.[1] || null,
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
 * Ottieni informazioni utente corrente
 */
async function getCurrentUserInfo(sessionId: string) {
  try {
    const userResult = await callOdoo(sessionId, 'res.users', 'search_read', [], {
      domain: [['id', '=', 'user_id']], // Special: user_id è l'utente corrente
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
    console.error('❌ Errore getCurrentUserInfo:', error);
    return { success: false, partnerId: null };
  }
}

/**
 * Chiama l'API JSON-RPC di Odoo
 */
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
      console.error('❌ Errore Odoo:', data.error);
      return { success: false, error: data.error.data?.message || data.error.message };
    }

    return { success: true, result: data.result };
  } catch (error: any) {
    console.error('❌ Errore callOdoo:', error);
    return { success: false, error: error.message };
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
