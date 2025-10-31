import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callOdoo } from '@/lib/odoo';

export const dynamic = 'force-dynamic';

const DEPOT = {
  lat: 47.5168872,
  lng: 8.5971149
};

export async function POST(request: Request) {
  try {
    const { dateFrom, dateTo } = await request.json();

    if (!dateFrom || !dateTo) {
      return NextResponse.json({
        error: 'dateFrom and dateTo are required'
      }, { status: 400 });
    }

    const cookieStore = cookies();

    // Build domain for WH/PICK filtering
    const domain = [
      ['name', 'like', 'WH/PICK'],
      ['scheduled_date', '>=', `${dateFrom} 00:00:00`],
      ['scheduled_date', '<=', `${dateTo} 23:59:59`],
      ['state', 'in', ['assigned', 'confirmed', 'waiting']]
    ];

    const fields = [
      'id',
      'name',
      'partner_id',
      'scheduled_date',
      'weight',
      'picking_type_id',
      'state',
      'move_ids',
      'user_id',
      'driver_id',
      'vehicle_id'
    ];

    // Load pickings from Odoo
    const pickings = await callOdoo(
      cookieStore,
      'stock.picking',
      'search_read',
      [],
      {
        domain,
        fields,
        limit: 2000
      }
    );

    // Process pickings and get coordinates
    const processedPickings: any[] = [];
    let withCoordinates = 0;

    for (const picking of pickings) {
      const partnerId = picking.partner_id ? picking.partner_id[0] : null;

      if (!partnerId) continue;

      // Get partner details with coordinates
      const partners = await callOdoo(
        cookieStore,
        'res.partner',
        'search_read',
        [],
        {
          domain: [['id', '=', partnerId]],
          fields: ['id', 'name', 'street', 'city', 'partner_latitude', 'partner_longitude'],
          limit: 1
        }
      );

      if (partners && partners.length > 0) {
        const partner = partners[0];
        let lat = partner.partner_latitude || null;
        let lng = partner.partner_longitude || null;

        // If no coordinates, generate random nearby for testing
        if (!lat || !lng) {
          lat = DEPOT.lat + (Math.random() - 0.5) * 0.3;
          lng = DEPOT.lng + (Math.random() - 0.5) * 0.3;
        } else {
          withCoordinates++;
        }

        // Calculate weight from picking or randomize for testing
        const weight = picking.weight || Math.floor(Math.random() * 200) + 50;

        processedPickings.push({
          id: picking.id,
          name: picking.name,
          partnerId: partnerId,
          partnerName: partner.name,
          address: `${partner.street || ''} ${partner.city || ''}`.trim() || 'Indirizzo non disponibile',
          lat: lat,
          lng: lng,
          weight: weight,
          scheduledDate: picking.scheduled_date,
          state: picking.state
        });
      }
    }

    return NextResponse.json({
      pickings: processedPickings,
      withCoordinates: withCoordinates,
      total: processedPickings.length
    });

  } catch (error: any) {
    console.error('Error loading pickings:', error);
    return NextResponse.json({
      error: error.message,
      pickings: []
    }, { status: 500 });
  }
}
