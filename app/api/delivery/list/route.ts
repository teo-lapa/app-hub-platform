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

    return NextResponse.json(deliveries);

  } catch (error: any) {
    console.error('[DELIVERY] Errore:', error.message);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento consegne' },
      { status: 500 }
    );
  }
}
