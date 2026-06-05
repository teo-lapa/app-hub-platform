import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from'); // YYYY-MM-DD
    const to = searchParams.get('to') || from; // YYYY-MM-DD

    if (!from) {
      return NextResponse.json({ error: 'Parametro "from" obbligatorio' }, { status: 400 });
    }

    const userCookies = request.headers.get('cookie');
    if (!userCookies) {
      return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
    }

    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid || !cookies) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const startDate = `${from} 00:00:00`;
    const endDate = `${to} 23:59:59`;

    const pickings = await callOdoo(
      cookies,
      'stock.picking',
      'search_read',
      [],
      {
        domain: [
          ['picking_type_code', '=', 'outgoing'],
          ['state', '=', 'done'],
          ['date_done', '>=', startDate],
          ['date_done', '<=', endDate],
        ],
        fields: [
          'name', 'partner_id', 'date_done', 'scheduled_date', 'driver_id', 'vehicle_id',
          'carrier_id', 'x_studio_cantone', 'weight', 'sale_id', 'origin',
        ],
        order: 'date_done asc',
      }
    );

    // Consegne ancora DA FARE (non completate) programmate nell'intervallo
    const todoPickings = await callOdoo(
      cookies,
      'stock.picking',
      'search_read',
      [],
      {
        domain: [
          ['picking_type_code', '=', 'outgoing'],
          ['state', 'in', ['assigned', 'confirmed', 'waiting']],
          ['scheduled_date', '>=', startDate],
          ['scheduled_date', '<=', endDate],
        ],
        fields: [
          'name', 'partner_id', 'date_done', 'scheduled_date', 'driver_id', 'vehicle_id',
          'carrier_id', 'x_studio_cantone', 'weight', 'sale_id', 'origin',
        ],
        order: 'scheduled_date asc',
      }
    );

    const allPickings = [
      ...(pickings || []).map((p: any) => ({ ...p, _status: 'done' })),
      ...(todoPickings || []).map((p: any) => ({ ...p, _status: 'todo' })),
    ];

    if (allPickings.length === 0) {
      return NextResponse.json({ deliveries: [], drivers: [], giri: [], missing: 0, depot: null });
    }

    // Coordinate dei clienti (+ id 1 = deposito LAPA Embrach, punto di partenza)
    const DEPOT_PARTNER_ID = 1;
    const partnerIds = Array.from(
      new Set([
        DEPOT_PARTNER_ID,
        ...allPickings.map((p: any) => p.partner_id?.[0]).filter(Boolean),
      ])
    );

    const partners = await callOdoo(
      cookies,
      'res.partner',
      'search_read',
      [],
      {
        domain: [['id', 'in', partnerIds]],
        fields: ['id', 'partner_latitude', 'partner_longitude', 'street', 'zip', 'city'],
      }
    );

    const partnerMap = new Map<number, any>();
    partners.forEach((p: any) => partnerMap.set(p.id, p));

    // Feedback autisti dal chatter: resi, scarichi parziali, prodotti non scaricati
    const pickingIds = allPickings.map((p: any) => p.id);
    const messages = await callOdoo(
      cookies,
      'mail.message',
      'search_read',
      [],
      {
        domain: [
          ['model', '=', 'stock.picking'],
          ['res_id', 'in', pickingIds],
          '|', '|',
          ['body', 'ilike', 'RESO REGISTRATO'],
          ['body', 'ilike', 'SCARICO PARZIALE'],
          ['body', 'ilike', 'NON SCARICATO'],
        ],
        fields: ['res_id', 'body', 'date'],
      }
    );

    const stripHtml = (s: string) =>
      (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

    const feedbackMap = new Map<number, any[]>();
    (messages || []).forEach((m: any) => {
      const body = m.body || '';
      let type = 'Feedback';
      if (body.includes('RESO REGISTRATO')) type = 'Reso';
      else if (body.includes('SCARICO PARZIALE')) type = 'Scarico parziale';
      else if (body.includes('NON SCARICATO')) type = 'Non scaricato';
      const entry = { type, text: stripHtml(body), date: m.date };
      if (!feedbackMap.has(m.res_id)) feedbackMap.set(m.res_id, []);
      feedbackMap.get(m.res_id)!.push(entry);
    });

    let missing = 0;
    const deliveries = allPickings
      .map((p: any) => {
        const partner = partnerMap.get(p.partner_id?.[0]);
        const lat = partner?.partner_latitude;
        const lng = partner?.partner_longitude;
        const hasCoords = lat && lng && (lat !== 0 || lng !== 0);
        if (!hasCoords) {
          missing++;
          return null;
        }
        return {
          id: p.id,
          name: p.name,
          customer: p.partner_id?.[1] || 'N/A',
          lat,
          lng,
          address: [partner?.street, partner?.zip, partner?.city].filter(Boolean).join(', '),
          driverId: p.driver_id?.[0] || 0,
          driverName: p.driver_id?.[1] || 'Senza autista',
          vehicle: p.vehicle_id?.[1] || '',
          giro: p.carrier_id?.[1] || '',
          cantone: p.x_studio_cantone || '',
          weight: p.weight || 0,
          status: p._status,
          time: p._status === 'done' ? p.date_done : p.scheduled_date,
          saleId: p.sale_id?.[0] || null,
          saleName: p.origin || p.sale_id?.[1] || '',
          feedback: feedbackMap.get(p.id) || [],
        };
      })
      .filter(Boolean);

    const drivers = Array.from(
      new Map(deliveries.map((d: any) => [d.driverId, d.driverName])).entries()
    ).map(([id, name]) => ({ id, name }));

    const giri = Array.from(
      new Set(deliveries.map((d: any) => d.giro).filter(Boolean))
    );

    const dp = partnerMap.get(DEPOT_PARTNER_ID);
    const depot = dp && dp.partner_latitude && dp.partner_longitude
      ? {
          lat: dp.partner_latitude,
          lng: dp.partner_longitude,
          name: 'Deposito LAPA Embrach',
          address: [dp.street, dp.zip, dp.city].filter(Boolean).join(', '),
        }
      : null;

    return NextResponse.json({ deliveries, drivers, giri, missing, depot });
  } catch (error: any) {
    console.error('Errore mappa consegne:', error);
    return NextResponse.json(
      { error: error.message || 'Errore recupero consegne' },
      { status: 500 }
    );
  }
}
