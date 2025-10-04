import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Aumenta timeout a 60 secondi

export async function GET(request: NextRequest) {
  try {
    // Autenticazione diretta con credenziali Paul

    const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
    const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: ODOO_DB,
          login: 'paul@lapa.ch',
          password: 'lapa201180'
        },
        id: 1
      })
    });

    const authData = await authResponse.json();
    const cookies = authResponse.headers.get('set-cookie');
    const uid = authData.result?.uid;

    if (!uid) {
      return NextResponse.json({ error: 'Autenticazione fallita' }, { status: 401 });
    }

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

    // Filtra documenti di oggi per questo driver
    const domain: any[] = [
      ['driver_id', '=', driverId],
      ['scheduled_date', '>=', todayStart],
      ['scheduled_date', '<=', todayEnd],
      ['state', 'in', ['assigned', 'done']],
      ['picking_type_id.code', '=', 'outgoing'],
      ['backorder_id', '=', false]
    ];

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

    if (pickings.length === 0) {
      return NextResponse.json([]);
    }

    // Carica partner e prodotti in BULK (performance)
    const partnerIdsSet = new Set(pickings.map((p: any) => p.partner_id?.[0]).filter(Boolean));
    const partnerIds = Array.from(partnerIdsSet);
    const allMoveIds = pickings.flatMap((p: any) => p.move_ids || []);

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

    // Carica tutti i move (prodotti) in una chiamata
    const allMoves = allMoveIds.length > 0 ? await callOdoo(
      cookies,
      'stock.move',
      'read',
      [allMoveIds],
      {
        fields: ['id', 'product_id', 'product_uom_qty', 'product_uom', 'picking_id']
      }
    ) : [];

    // Crea mappa per accesso rapido
    const partnerMap = new Map(allPartners.map((p: any) => [p.id, p]));
    const movesByPicking = new Map<number, any[]>();
    allMoves.forEach((move: any) => {
      const pickingId = move.picking_id?.[0];
      if (!movesByPicking.has(pickingId)) {
        movesByPicking.set(pickingId, []);
      }
      movesByPicking.get(pickingId)!.push(move);
    });

    // Assembla deliveries
    const deliveries = [];

    for (const picking of pickings) {
      const partnerId = picking.partner_id?.[0];
      if (!partnerId) continue;

      const partner = partnerMap.get(partnerId);
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

      // Ottieni prodotti per questo picking
      const pickingMoves = movesByPicking.get(picking.id) || [];
      const products = pickingMoves.map((move: any) => ({
        id: move.id,
        name: move.product_id?.[1] || 'Prodotto',
        qty: move.product_uom_qty || 0,
        delivered: 0,
        picked: false,
        unit: move.product_uom?.[1] || 'Unità'
      }));

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

    return NextResponse.json(deliveries);

  } catch (error: any) {
    console.error('[DELIVERY] Errore:', error.message);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento consegne' },
      { status: 500 }
    );
  }
}
