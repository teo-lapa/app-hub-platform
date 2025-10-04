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

    // Get today's date in Europe/Zurich timezone
    // Usa toLocaleString direttamente per ottenere la data corretta
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zurich',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const todayDateOnly = formatter.format(new Date()); // Formato: YYYY-MM-DD

    console.log('📅 [DELIVERY] Data OGGI (Europe/Zurich):', todayDateOnly);

    // Build domain - SENZA filtro data (lo faremo lato server)
    const domain: any[] = [
      ['state', 'in', ['assigned', 'done']],
      ['picking_type_id.code', '=', 'outgoing'],
      ['backorder_id', '=', false]
    ];

    if (employee && employee.length > 0) {
      console.log('👤 [DELIVERY] Employee trovato:', employee[0].name, 'ID:', employee[0].id);
      domain.push(['driver_id', '=', employee[0].id]);  // SOLO consegne del driver loggato
      console.log('✅ [DELIVERY] Filtro driver aggiunto: driver_id =', employee[0].id);
    } else {
      console.log('⚠️ [DELIVERY] Nessun employee associato, mostro TUTTE le consegne di oggi');
    }

    console.log('🔍 [DELIVERY] Domain filtri completo:', JSON.stringify(domain));

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

    console.log(`📦 [DELIVERY] Trovati ${pickings.length} documenti da Odoo`);

    // FILTRO LATO SERVER per data di OGGI (evita problemi timezone con Odoo)
    let filteredPickings = pickings.filter((p: any) => {
      if (!p.scheduled_date) {
        console.log(`❌ [FILTER DATE] ${p.name}: nessuna data programmata`);
        return false;
      }

      // Estrae solo YYYY-MM-DD ignorando ora e timezone
      const pickingDateOnly = p.scheduled_date.split(' ')[0];
      const isToday = pickingDateOnly === todayDateOnly;

      if (isToday) {
        console.log(`✅ [FILTER DATE] ${p.name}: ${pickingDateOnly} = ${todayDateOnly}`);
      } else {
        console.log(`❌ [FILTER DATE] ${p.name}: ${pickingDateOnly} != ${todayDateOnly}`);
      }

      return isToday;
    });

    // FILTRO LATO SERVER per DRIVER (se employee trovato)
    if (employee && employee.length > 0) {
      const employeeId = employee[0].id;
      console.log(`🚗 [FILTER DRIVER] Filtro per driver ID: ${employeeId} (${employee[0].name})`);

      filteredPickings = filteredPickings.filter((p: any) => {
        const driverId = p.driver_id ? p.driver_id[0] : null;
        const driverName = p.driver_id ? p.driver_id[1] : 'Nessun driver';

        if (driverId === employeeId) {
          console.log(`✅ [FILTER DRIVER] ${p.name}: driver ${driverName} (ID: ${driverId}) = ${employeeId}`);
          return true;
        } else {
          console.log(`❌ [FILTER DRIVER] ${p.name}: driver ${driverName} (ID: ${driverId}) != ${employeeId}`);
          return false;
        }
      });
    }

    console.log(`📦 [DELIVERY] Dopo filtro data: ${filteredPickings.length} consegne di OGGI`);

    if (filteredPickings.length === 0) {
      return NextResponse.json([]);
    }

    // OTTIMIZZAZIONE: Bulk reads invece di loop
    // 1. Raccogli tutti gli ID (da filteredPickings!)
    const partnerIds = filteredPickings.map((p: any) => p.partner_id?.[0]).filter(Boolean);
    const allMoveIds = filteredPickings.flatMap((p: any) => p.move_ids || []);

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
    for (const picking of filteredPickings) {
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
        driver: picking.driver_id ? picking.driver_id[1] : 'Nessun driver',  // AGGIUNGI DRIVER
        driverId: picking.driver_id ? picking.driver_id[0] : null,
        scheduledDate: picking.scheduled_date,
        backorderId: picking.backorder_id,
        isBackorder: picking.backorder_id ? true : false,
        completed: picking.state === 'done'
      });
    }

    console.log(`✅ [DELIVERY] Caricate ${deliveries.length} consegne con dettagli`);

    // DEBUG: Mostra driver di ogni consegna
    console.log('🚗 [DEBUG] Driver per ogni consegna:');
    deliveries.forEach(d => {
      console.log(`  - ${d.name}: ${d.driver} (ID: ${d.driverId})`);
    });

    return NextResponse.json(deliveries);
  } catch (error: any) {
    console.error('❌ [DELIVERY] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento consegne' },
      { status: 500 }
    );
  }
}
