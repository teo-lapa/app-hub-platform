import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      return NextResponse.json({
        error: 'Devi effettuare il login'
      }, { status: 401 });
    }

    const { cookies } = await getOdooSession(userCookies);

    if (!cookies) {
      return NextResponse.json({
        error: 'Sessione non valida'
      }, { status: 401 });
    }

    // Get today's date
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zurich',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const todayDateOnly = formatter.format(new Date());
    const todayStart = `${todayDateOnly} 00:00:00`;
    const todayEnd = `${todayDateOnly} 23:59:59`;

    // Carica tutte le consegne di oggi (non ancora completate)
    const pickings = await callOdoo(
      cookies,
      'stock.picking',
      'search_read',
      [],
      {
        domain: [
          ['scheduled_date', '>=', todayStart],
          ['scheduled_date', '<=', todayEnd],
          ['state', '=', 'assigned'],
          ['picking_type_id.code', '=', 'outgoing']
        ],
        fields: ['id', 'name', 'partner_id', 'scheduled_date', 'note', 'origin'],
        limit: 100,
        order: 'scheduled_date ASC'
      }
    );

    // Carica partner per coordinate GPS
    const partnerIds = pickings.map((p: any) => p.partner_id?.[0]).filter(Boolean);
    const partners = partnerIds.length > 0 ? await callOdoo(
      cookies,
      'res.partner',
      'read',
      [partnerIds],
      {
        fields: ['name', 'street', 'city', 'zip', 'partner_latitude', 'partner_longitude']
      }
    ) : [];

    const partnerMap = new Map(partners.map((p: any) => [p.id, p]));

    // Costruisci deliveries
    const deliveries = pickings.map((picking: any, index: number) => {
      const partnerId = picking.partner_id?.[0];
      const partner: any = partnerMap.get(partnerId);

      if (!partner) return null;

      return {
        id: picking.id,
        name: picking.name,
        customer: partner.name,
        address: `${partner.street || ''}, ${partner.city || ''} ${partner.zip || ''}`.trim(),
        lat: partner.partner_latitude || 0,
        lng: partner.partner_longitude || 0,
        priority: index + 1,
        estimatedTime: 15 // Default 15 min per consegna
      };
    }).filter(Boolean);

    return NextResponse.json({
      deliveries,
      total: deliveries.length
    });

  } catch (error: any) {
    console.error('[SMART-ROUTE] Errore:', error.message);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento consegne' },
      { status: 500 }
    );
  }
}
