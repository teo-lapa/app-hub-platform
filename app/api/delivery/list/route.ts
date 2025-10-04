import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Aumenta timeout a 60 secondi

export async function GET(request: NextRequest) {
  try {
    console.log('🚚 [DELIVERY] Inizio caricamento consegne...');

    // Get cookies from user request
    const cookieHeader = request.headers.get('cookie');

    // Autenticazione con Odoo
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [DELIVERY] Sessione non valida');
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    console.log('✅ [DELIVERY] Autenticato, UID:', uid);

    // Cerca employee_id dell'utente loggato
    const uidNum = typeof uid === 'string' ? parseInt(uid) : uid;

    console.log(`🔍 [DELIVERY] Cerco hr.employee con user_id=${uidNum}...`);

    const employees = await callOdoo(
      cookies,
      'hr.employee',
      'search_read',
      [],
      {
        domain: [['user_id', '=', uidNum]],
        fields: ['id', 'name', 'user_id'],
        limit: 1
      }
    );

    console.log(`📋 [DELIVERY] Dipendenti trovati: ${employees.length}`);
    console.log(`📋 [DELIVERY] Risultato ricerca:`, JSON.stringify(employees, null, 2));

    if (employees.length === 0) {
      console.error(`❌ [DELIVERY] Nessun dipendente trovato per user_id=${uidNum}`);

      // DEBUG: Mostra TUTTI i dipendenti per capire il problema
      console.log(`🔍 [DELIVERY] DEBUG - Carico TUTTI i dipendenti per analisi...`);
      const allEmployees = await callOdoo(
        cookies,
        'hr.employee',
        'search_read',
        [],
        {
          domain: [],
          fields: ['id', 'name', 'user_id'],
          limit: 50
        }
      );
      console.log(`📋 [DELIVERY] TUTTI i dipendenti (${allEmployees.length}):`, JSON.stringify(allEmployees, null, 2));

      return NextResponse.json({
        error: `Dipendente non trovato per user_id=${uidNum}. Controlla in Odoo che il campo "Utente collegato" del dipendente sia compilato.`,
        debug: {
          uid: uidNum,
          employeesFound: 0,
          hint: 'Vai in Odoo → Risorse Umane → Dipendenti → Trova il tuo dipendente → Compila campo "Utente collegato"'
        }
      }, { status: 403 });
    }

    const driverId = employees[0].id;
    const driverName = employees[0].name;
    const userIdField = employees[0].user_id;
    console.log(`✅ [DELIVERY] Driver trovato: ${driverName} (employee_id=${driverId})`);
    console.log(`📋 [DELIVERY] user_id field value:`, JSON.stringify(userIdField));

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

    console.log('📅 [DELIVERY] Oggi:', todayDateOnly);

    // Domain semplice - SOLO documenti di oggi con driver_id
    const domain: any[] = [
      ['driver_id', '=', driverId],
      ['scheduled_date', '>=', todayStart],
      ['scheduled_date', '<=', todayEnd],
      ['state', 'in', ['assigned', 'done']],
      ['picking_type_id.code', '=', 'outgoing'],
      ['backorder_id', '=', false]
    ];

    console.log('🔍 [DELIVERY] Domain:', JSON.stringify(domain));

    // Load pickings - SEMPLICE
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
          'backorder_id'
        ],
        limit: 50,
        order: 'scheduled_date ASC'
      }
    );

    console.log(`📦 [DELIVERY] Odoo ha ritornato ${pickings.length} documenti per driver_id=${driverId}`);

    // DEBUG: Mostra i primi 3 documenti con i loro driver_id
    if (pickings.length > 0) {
      console.log(`🔍 [DELIVERY] Primi 3 documenti con driver_id:`);
      pickings.slice(0, 3).forEach((p: any) => {
        console.log(`  - ${p.name}: driver_id=${p.driver_id ? p.driver_id[0] : 'NULL'} (${p.driver_id ? p.driver_id[1] : 'nessuno'})`);
      });
    }

    if (pickings.length === 0) {
      console.warn(`⚠️ [DELIVERY] Nessun documento trovato per driver_id=${driverId} oggi`);
      return NextResponse.json([]);
    }

    // Assembla deliveries - LOOP SEMPLICE come HTML
    const deliveries = [];

    for (const picking of pickings) {
      const partnerId = picking.partner_id?.[0];
      if (!partnerId) continue;

      // Carica partner singolo
      const partners = await callOdoo(
        cookies,
        'res.partner',
        'read',
        [[partnerId]],
        {
          fields: ['name', 'street', 'street2', 'city', 'zip', 'phone', 'mobile', 'partner_latitude', 'partner_longitude']
        }
      );

      if (!partners || partners.length === 0) continue;

      const partner = partners[0];

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
        latitude: partner.partner_latitude || null,
        longitude: partner.partner_longitude || null,
        partner_street: partner.street || '',
        partner_city: partner.city || '',
        partner_zip: partner.zip || '',
        partner_phone: partner.phone || partner.mobile || '',
        products: [], // Caricati dopo se serve
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

    console.log(`✅ [DELIVERY] Ritorno ${deliveries.length} consegne`);

    return NextResponse.json(deliveries);

  } catch (error: any) {
    console.error('❌ [DELIVERY] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento consegne' },
      { status: 500 }
    );
  }
}
