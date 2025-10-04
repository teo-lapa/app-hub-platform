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

    // Get today's date range for Odoo filter (00:00:00 to 23:59:59)
    const swissTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Zurich' });
    const today = new Date(swissTime);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const todayStart = `${year}-${month}-${day} 00:00:00`;
    const todayEnd = `${year}-${month}-${day} 23:59:59`;

    console.log('📅 [DELIVERY] Filtro data OGGI:', todayStart, 'to', todayEnd);

    // Build domain - FILTRO ODOO CORRETTO con operatori Polish notation
    // & combina le prime 2 condizioni, poi le altre sono AND impliciti
    const domain: any[] = [
      '&', '&', '&', '&',  // 4 operatori & per 5 condizioni
      ['scheduled_date', '>=', todayStart],
      ['scheduled_date', '<=', todayEnd],
      ['state', 'in', ['assigned', 'done']],
      ['picking_type_id.code', '=', 'outgoing'],
      ['backorder_id', '=', false]
    ];

    if (employee && employee.length > 0) {
      console.log('👤 [DELIVERY] Employee trovato:', employee[0].name, 'ID:', employee[0].id);
      // Aggiungi un altro operatore & perché stiamo aggiungendo una condizione
      domain.unshift('&');
      domain.push(['driver_id', '=', employee[0].id]);  // SOLO consegne del driver loggato
    } else {
      console.log('⚠️ [DELIVERY] Nessun employee associato, mostro TUTTE le consegne di oggi');
    }

    console.log('🔍 [DELIVERY] Domain filtri:', JSON.stringify(domain));

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

    console.log(`📦 [DELIVERY] Trovati ${pickings.length} consegne di OGGI da Odoo`);

    if (pickings.length === 0) {
      return NextResponse.json([]);
    }

    // OTTIMIZZAZIONE: Bulk reads invece di loop
    // 1. Raccogli tutti gli ID
    const partnerIds = pickings.map((p: any) => p.partner_id?.[0]).filter(Boolean);
    const allMoveIds = pickings.flatMap((p: any) => p.move_ids || []);

    // 2. Fetch TUTTI i partners in UNA chiamata
    const partnersMap = new Map();
    if (partnerIds.length > 0) {
      const partners = await callOdoo(cookies, 'res.partner', 'search_read', [], {
        domain: [['id', 'in', partnerIds]],
        fields: ['id', 'name', 'street', 'street2', 'city', 'zip', 'phone', 'mobile', 'partner_latitude', 'partner_longitude']
      });
      partners.forEach((p: any) => partnersMap.set(p.id, p));
    }

    // 3. Fetch TUTTI i moves in UNA chiamata
    const movesMap = new Map();
    if (allMoveIds.length > 0) {
      const moves = await callOdoo(cookies, 'stock.move', 'search_read', [], {
        domain: [['id', 'in', allMoveIds]],
        fields: ['id', 'picking_id', 'product_id', 'product_uom_qty']
      });
      moves.forEach((m: any) => {
        const pickingId = Array.isArray(m.picking_id) ? m.picking_id[0] : m.picking_id;
        if (!movesMap.has(pickingId)) movesMap.set(pickingId, []);
        movesMap.get(pickingId).push(m);
      });
    }

    // 4. Fetch TUTTI i products in UNA chiamata
    const productIds = allMoveIds.length > 0 ?
      (await callOdoo(cookies, 'stock.move', 'search_read', [], {
        domain: [['id', 'in', allMoveIds]],
        fields: ['product_id']
      })).map((m: any) => m.product_id[0]).filter(Boolean) : [];

    const productsMap = new Map();
    if (productIds.length > 0) {
      const products = await callOdoo(cookies, 'product.product', 'search_read', [], {
        domain: [['id', 'in', productIds]],
        fields: ['id', 'name', 'image_128', 'categ_id']
      });
      products.forEach((p: any) => productsMap.set(p.id, p));
    }

    console.log(`✅ [DELIVERY] Caricati ${partnersMap.size} partners, ${movesMap.size} pickings con moves, ${productsMap.size} products`);

    // 5. Assembla deliveries usando le mappe (NO LOOP ODOO!)
    const deliveries = [];
    for (const picking of pickings) {
      const partnerId = picking.partner_id?.[0];
      if (!partnerId) continue;

      const partner = partnersMap.get(partnerId);
      if (!partner) continue;

      // Get products from map
      const pickingMoves = movesMap.get(picking.id) || [];
      const products = pickingMoves.map((move: any) => {
        const productId = move.product_id[0];
        const product = productsMap.get(productId);
        if (!product) return null;

        return {
          id: product.id,
          name: move.product_id[1],
          qty: move.product_uom_qty,
          image: product.image_128 || null,
          category: product.categ_id ? product.categ_id[1] : 'Altro',
          delivered: 0
        };
      }).filter(Boolean);

      // Build address
      let address = '';
      if (partner.street) address += partner.street;
      if (partner.street2) address += ', ' + partner.street2;
      if (partner.zip || partner.city) {
        address += ', ';
        if (partner.zip) address += partner.zip + ' ';
        if (partner.city) address += partner.city;
      }

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
