import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    console.log('🚚 [DELIVERY-v3] Inizio caricamento consegne...');

    // Get all cookies from user request
    const cookieHeader = request.headers.get('cookie');
    console.log('🍪 [DELIVERY] Cookies ricevuti:', cookieHeader ? 'presenti' : 'assenti');

    // Autenticazione con Odoo - usa sessione utente se disponibile
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [DELIVERY] Sessione non valida');
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    console.log('✅ [DELIVERY] Autenticato con Odoo, UID:', uid);

    // Get employee info - ESATTAMENTE COME L'HTML
    const employee = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
      domain: [['user_id', '=', uid]],
      fields: ['id', 'name'],
      limit: 1
    });

    // Get today's date range (start and end of day in UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString().split('T')[0] + ' 00:00:00';

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = tomorrow.toISOString().split('T')[0] + ' 00:00:00';

    console.log('📅 [DELIVERY] Filtro data: oggi da', todayStart, 'a', tomorrowStart);

    // Build domain with driver filter - SOLO DOCUMENTI DI OGGI pronti (assigned)
    const domain = [
      ['picking_type_id.code', '=', 'outgoing'],
      ['state', '=', 'assigned'],  // SOLO pronti, NON completati
      ['scheduled_date', '>=', todayStart],
      ['scheduled_date', '<', tomorrowStart]
    ];

    if (employee && employee.length > 0) {
      console.log('👤 [DELIVERY] Employee trovato:', employee[0].name, 'ID:', employee[0].id);
      domain.push(['driver_id', '=', employee[0].id]);
    } else {
      console.log('⚠️ [DELIVERY] Nessun employee, mostro tutti i documenti di oggi');
    }

    // COPIA ESATTA DELLA LOGICA HTML
    // Load pickings - ESATTAMENTE COME L'HTML
    const pickings = await callOdoo(
      cookies,
      'stock.picking',
      'search_read',
      [],
      {
        domain: domain,
        fields: [
          'id', 'name', 'partner_id', 'scheduled_date',
          'state', 'note', 'move_ids', 'origin',
          'driver_id', 'vehicle_id', 'carrier_id',
          'backorder_id'
        ],
        limit: 50,
        order: 'scheduled_date DESC'
      }
    );

    console.log(`📦 [DELIVERY] Trovati ${pickings.length} documenti`);

    const deliveries = [];

    // Process each picking - ESATTAMENTE COME L'HTML
    for (const picking of pickings) {
      if (!picking.partner_id) continue;

      // Get partner details - ESATTAMENTE COME L'HTML
      const partners = await callOdoo(
        cookies,
        'res.partner',
        'search_read',
        [],
        {
          domain: [['id', '=', picking.partner_id[0]]],
          fields: ['name', 'street', 'street2', 'city', 'zip', 'phone', 'mobile', 'partner_latitude', 'partner_longitude'],
          limit: 1
        }
      );

      const partner = partners[0];
      if (!partner) continue;

      // Get products - ESATTAMENTE COME L'HTML
      let products = [];
      if (picking.move_ids && picking.move_ids.length > 0) {
        const moves = await callOdoo(
          cookies,
          'stock.move',
          'search_read',
          [],
          {
            domain: [['id', 'in', picking.move_ids]],
            fields: ['product_id', 'product_uom_qty'],
            limit: 100
          }
        );

        // Get product details with images and category
        for (const move of moves) {
          const productDetails = await callOdoo(
            cookies,
            'product.product',
            'search_read',
            [],
            {
              domain: [['id', '=', move.product_id[0]]],
              fields: ['id', 'name', 'image_128', 'categ_id'],
              limit: 1
            }
          );

          const product = productDetails[0];
          if (product) {
            products.push({
              id: product.id,
              name: move.product_id[1],
              qty: move.product_uom_qty,
              image: product.image_128 || null,
              category: product.categ_id ? product.categ_id[1] : 'Altro',
              delivered: 0 // Quantità scaricata
            });
          }
        }
      }

      // Build address - ESATTAMENTE COME L'HTML
      let address = '';
      if (partner.street) address += partner.street;
      if (partner.street2) address += ', ' + partner.street2;
      if (partner.zip || partner.city) {
        address += ', ';
        if (partner.zip) address += partner.zip + ' ';
        if (partner.city) address += partner.city;
      }

      // Crea delivery - ESATTAMENTE COME L'HTML
      deliveries.push({
        id: picking.id,
        name: picking.name,
        customer: partner.name,
        customerName: partner.name,
        address: address.trim(),
        phone: partner.phone || partner.mobile || '',
        lat: partner.partner_latitude || null,
        lng: partner.partner_longitude || null,
        products: products,
        note: picking.note || '',
        state: picking.state,
        origin: picking.origin || '',
        carrier: picking.carrier_id ? picking.carrier_id[1] : '',
        scheduledDate: picking.scheduled_date,
        backorderId: picking.backorder_id,
        isBackorder: picking.backorder_id ? true : false,
        completed: picking.state === 'done'
      });
    }

    console.log(`✅ [DELIVERY] Caricate ${deliveries.length} consegne con dettagli`);

    return NextResponse.json(deliveries);
  } catch (error: any) {
    console.error('❌ [DELIVERY] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento consegne' },
      { status: 500 }
    );
  }
}
