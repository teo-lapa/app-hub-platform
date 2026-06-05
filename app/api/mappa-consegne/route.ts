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
          'name', 'partner_id', 'date_done', 'driver_id', 'vehicle_id',
          'carrier_id', 'x_studio_cantone', 'weight', 'sale_id', 'origin',
        ],
        order: 'date_done asc',
      }
    );

    if (!pickings || pickings.length === 0) {
      return NextResponse.json({ deliveries: [], drivers: [], giri: [], missing: 0 });
    }

    // Coordinate dei clienti
    const partnerIds = Array.from(
      new Set(pickings.map((p: any) => p.partner_id?.[0]).filter(Boolean))
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

    let missing = 0;
    const deliveries = pickings
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
          time: p.date_done,
          saleId: p.sale_id?.[0] || null,
          saleName: p.origin || p.sale_id?.[1] || '',
        };
      })
      .filter(Boolean);

    const drivers = Array.from(
      new Map(deliveries.map((d: any) => [d.driverId, d.driverName])).entries()
    ).map(([id, name]) => ({ id, name }));

    const giri = Array.from(
      new Set(deliveries.map((d: any) => d.giro).filter(Boolean))
    );

    return NextResponse.json({ deliveries, drivers, giri, missing });
  } catch (error: any) {
    console.error('Errore mappa consegne:', error);
    return NextResponse.json(
      { error: error.message || 'Errore recupero consegne' },
      { status: 500 }
    );
  }
}
