import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Aumenta timeout a 60 secondi

export async function GET(request: NextRequest) {
  try {
    // Usa la sessione dell'utente loggato invece di credenziali hardcoded
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      return NextResponse.json({
        error: 'Devi effettuare il login sulla piattaforma prima di usare l\'app delivery'
      }, { status: 401 });
    }

    const { cookies, uid } = await getOdooSession(userCookies);

    if (!uid || !cookies) {
      return NextResponse.json({
        error: 'Sessione non valida. Effettua nuovamente il login.'
      }, { status: 401 });
    }

    console.log('✅ [DELIVERY] Utente autenticato con UID:', uid);

    // Cerca employee_id dell'utente loggato
    const uidNum = typeof uid === 'string' ? parseInt(uid) : uid;

    const employees = await callOdoo(
      cookies,
      'hr.employee',
      'search_read',
      [],
      {
        domain: [['user_id', '=', uidNum]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (employees.length === 0) {
      return NextResponse.json({
        error: 'Dipendente non trovato. Verifica configurazione in Odoo.'
      }, { status: 403 });
    }

    const driverId = employees[0].id;
    const driverName = employees[0].name;

    console.log('🚚 [DELIVERY] Driver trovato:', { driverId, driverName });

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

    console.log('📅 [DELIVERY] Range date:', { todayStart, todayEnd });

    // Mostra consegne di oggi (TUTTI gli stati tranne cancel)
    const domain: any[] = [
      ['driver_id', '=', driverId],
      ['scheduled_date', '>=', todayStart],
      ['scheduled_date', '<=', todayEnd],
      ['state', '!=', 'cancel'],  // Escludi solo quelle cancellate
      ['picking_type_id.code', '=', 'outgoing'],
      ['backorder_id', '=', false]
    ];

    console.log('🔍 [DELIVERY] Domain filtro con driver_id=' + driverId + ':', JSON.stringify(domain));

    // Load pickings con move_ids (prodotti)
    const pickings = await callOdoo(
      cookies,
      'stock.picking',
      'search_read',
      [],
      {
        domain: domain,
        fields: [
          'id', 'name', 'partner_id', 'scheduled_date',
          'state', 'note', 'origin', 'driver_id',
          'backorder_id', 'move_ids'
        ],
        limit: 50,
        order: 'scheduled_date ASC'
      }
    );

    console.log('📦 [DELIVERY] Pickings trovati per ' + driverName + ':', pickings.length);

    // DEBUG: Stampa TUTTI i pickings trovati per analizzare il problema
    if (pickings.length > 0) {
      console.log('🔍 [DEBUG] TUTTI I PICKINGS TROVATI:');
      pickings.forEach((p: any) => {
        console.log(`   - ID: ${p.id}, Name: ${p.name}, State: ${p.state}, Scheduled: ${p.scheduled_date}, Driver: ${p.driver_id?.[1]}`);
      });
    }

    if (pickings.length === 0) {
      console.log('⚠️ [DELIVERY] Nessuna consegna assegnata a ' + driverName + ' (ID: ' + driverId + ') per oggi');

      // DEBUG: Cerca TUTTI i documenti di questa settimana per TUTTI gli autisti
      console.log('🔍 [DEBUG] Cerco TUTTI i documenti di questa settimana (2-8 ottobre)...');
      const weekStart = '2025-10-02 00:00:00';
      const weekEnd = '2025-10-08 23:59:59';

      const allWeekPickings = await callOdoo(
        cookies,
        'stock.picking',
        'search_read',
        [],
        {
          domain: [
            ['scheduled_date', '>=', weekStart],
            ['scheduled_date', '<=', weekEnd],
            ['picking_type_id.code', '=', 'outgoing']
          ],
          fields: ['id', 'name', 'state', 'scheduled_date', 'driver_id', 'partner_id'],
          limit: 100,
          order: 'scheduled_date DESC'
        }
      );

      console.log('🔍 [DEBUG] Documenti trovati questa settimana:', allWeekPickings.length);
      allWeekPickings.forEach((p: any) => {
        const driverInfo = p.driver_id ? `${p.driver_id[1]} (ID: ${p.driver_id[0]})` : 'NESSUN DRIVER';
        const partnerInfo = p.partner_id ? p.partner_id[1] : 'N/A';
        console.log(`   - ID: ${p.id}, Name: ${p.name}, State: ${p.state}, Scheduled: ${p.scheduled_date}, Driver: ${driverInfo}, Cliente: ${partnerInfo}`);
      });

      // DEBUG: Cerca i 3 documenti specifici che l'utente ha menzionato
      console.log('🔍 [DEBUG] Cerco i 3 documenti specifici: WH/OUT/33118, WH/OUT/33110, WH/OUT/32991');
      const specificDocs = await callOdoo(
        cookies,
        'stock.picking',
        'search_read',
        [],
        {
          domain: [
            ['name', 'in', ['WH/OUT/33118', 'WH/OUT/33110', 'WH/OUT/32991']]
          ],
          fields: ['id', 'name', 'state', 'scheduled_date', 'driver_id', 'partner_id'],
          limit: 10
        }
      );

      console.log('🔍 [DEBUG] Documenti specifici trovati:', specificDocs.length);
      specificDocs.forEach((p: any) => {
        const driverInfo = p.driver_id ? `${p.driver_id[1]} (ID: ${p.driver_id[0]})` : 'NESSUN DRIVER ASSEGNATO';
        const partnerInfo = p.partner_id ? p.partner_id[1] : 'N/A';
        console.log(`   ⭐ ID: ${p.id}, Name: ${p.name}, State: ${p.state}, Scheduled: ${p.scheduled_date}`);
        console.log(`      Driver: ${driverInfo}`);
        console.log(`      Cliente: ${partnerInfo}`);
      });

      return NextResponse.json({
        deliveries: [],
        driver: {
          id: driverId,
          name: driverName
        }
      });
    }

    // Carica partner e prodotti in BULK (performance)
    const partnerIdsSet = new Set(pickings.map((p: any) => p.partner_id?.[0]).filter(Boolean));
    const partnerIds = Array.from(partnerIdsSet);
    const allPickingIds = pickings.map((p: any) => p.id);

    // Carica tutti i partner in una chiamata
    const allPartners = await callOdoo(
      cookies,
      'res.partner',
      'read',
      [partnerIds],
      {
        fields: ['name', 'street', 'street2', 'city', 'zip', 'phone', 'mobile', 'partner_latitude', 'partner_longitude']
      }
    );

    // IMPORTANTE: Carica stock.move.line (operazioni dettagliate) invece di stock.move
    // Questo permette di modificare le quantità effettive (qty_done)
    const allMoveLines = allPickingIds.length > 0 ? await callOdoo(
      cookies,
      'stock.move.line',
      'search_read',
      [],
      {
        domain: [['picking_id', 'in', allPickingIds]],
        fields: ['id', 'product_id', 'quantity', 'qty_done', 'product_uom_id', 'picking_id', 'move_id']
      }
    ) : [];

    // Carica immagini prodotti
    const productIdsSet = new Set(allMoveLines.map((m: any) => m.product_id?.[0]).filter(Boolean));
    const productIds = Array.from(productIdsSet);
    const products = productIds.length > 0 ? await callOdoo(
      cookies,
      'product.product',
      'read',
      [productIds],
      {
        fields: ['id', 'image_128']
      }
    ) : [];
    const productImageMap = new Map(products.map((p: any) => [p.id, p.image_128]));

    // Crea mappa per accesso rapido
    const partnerMap = new Map(allPartners.map((p: any) => [p.id, p]));
    const moveLinesByPicking = new Map<number, any[]>();
    allMoveLines.forEach((moveLine: any) => {
      const pickingId = moveLine.picking_id?.[0];
      if (!moveLinesByPicking.has(pickingId)) {
        moveLinesByPicking.set(pickingId, []);
      }
      moveLinesByPicking.get(pickingId)!.push(moveLine);
    });

    // Assembla deliveries
    const deliveries = [];

    for (const picking of pickings) {
      const partnerId = picking.partner_id?.[0];
      if (!partnerId) continue;

      const partner: any = partnerMap.get(partnerId);
      if (!partner) continue;

      // Build address
      let address = '';
      if (partner.street) address += partner.street;
      if (partner.street2) address += ', ' + partner.street2;
      if (partner.zip || partner.city) {
        address += ', ';
        if (partner.zip) address += partner.zip + ' ';
        if (partner.city) address += partner.city;
      }

      // Ottieni prodotti per questo picking (da stock.move.line)
      const pickingMoveLines = moveLinesByPicking.get(picking.id) || [];
      const isCompleted = picking.state === 'done';
      const products = pickingMoveLines.map((moveLine: any) => {
        const productId = moveLine.product_id?.[0];
        const requestedQty = moveLine.quantity || 0;  // quantity = quantità pianificata
        const deliveredQty = moveLine.qty_done || 0;  // qty_done = quantità effettiva
        return {
          id: moveLine.id,  // Questo è il move_line_id!
          move_line_id: moveLine.id,  // ID della stock.move.line
          product_id: productId,
          name: moveLine.product_id?.[1] || 'Prodotto',
          qty: requestedQty,
          delivered: deliveredQty,
          picked: deliveredQty > 0,
          unit: moveLine.product_uom_id?.[1] || 'Unità',
          image: productImageMap.get(productId) || null
        };
      });

      deliveries.push({
        id: picking.id,
        name: picking.name,
        customer: partner.name,
        customerName: partner.name,
        address: address.trim(),
        phone: partner.phone || partner.mobile || '',
        lat: partner.partner_latitude || null,
        lng: partner.partner_longitude || null,
        latitude: partner.partner_latitude || null,
        longitude: partner.partner_longitude || null,
        partner_street: partner.street || '',
        partner_city: partner.city || '',
        partner_zip: partner.zip || '',
        partner_phone: partner.phone || partner.mobile || '',
        products: products,
        note: picking.note || '',
        state: picking.state,
        origin: picking.origin || '',
        driver: picking.driver_id ? picking.driver_id[1] : driverName,
        driverId: driverId,
        scheduledDate: picking.scheduled_date,
        backorderId: picking.backorder_id,
        isBackorder: picking.backorder_id ? true : false,
        completed: picking.state === 'done'
      });
    }

    return NextResponse.json({
      deliveries,
      driver: {
        id: driverId,
        name: driverName
      }
    });

  } catch (error: any) {
    console.error('[DELIVERY] Errore:', error.message);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento consegne' },
      { status: 500 }
    );
  }
}

