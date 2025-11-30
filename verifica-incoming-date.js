/**
 * Verifica campi per data arrivo prevista in Odoo
 */

const xmlrpc = require('xmlrpc');

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Crea client XML-RPC
const commonClient = xmlrpc.createSecureClient({
  host: new URL(ODOO_URL).hostname,
  port: 443,
  path: '/xmlrpc/2/common'
});

const objectClient = xmlrpc.createSecureClient({
  host: new URL(ODOO_URL).hostname,
  port: 443,
  path: '/xmlrpc/2/object'
});

async function authenticate() {
  return new Promise((resolve, reject) => {
    commonClient.methodCall('authenticate', [
      ODOO_DB,
      ODOO_EMAIL,
      ODOO_PASSWORD,
      {}
    ], (err, uid) => {
      if (err) reject(err);
      else resolve(uid);
    });
  });
}

async function call(uid, model, method, domain, options = {}) {
  return new Promise((resolve, reject) => {
    const methodArgs = [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      model,
      method,
      [domain]  // domain deve essere in un array
    ];

    // Aggiungi opzioni solo se non vuote
    if (Object.keys(options).length > 0) {
      methodArgs.push(options);
    }

    objectClient.methodCall('execute_kw', methodArgs, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function verificaIncomingDate() {
  console.log('🔍 VERIFICA INCOMING DATE - Fiordilatte Julienne');
  console.log('='.repeat(80));

  try {
    // Authenticate
    console.log('🔐 Authenticating...');
    const uid = await authenticate();
    console.log(`✅ Authenticated as UID: ${uid}`);

    // 1. Cerca il prodotto Fiordilatte
    console.log('\n📦 STEP 1: Cerca prodotto Fiordilatte...');
    const products = await call(uid, 'product.product', 'search_read',
      [['name', 'ilike', 'FIORDILATTE JULIENNE']], // domain senza wrapper esterno
      {
        fields: ['id', 'name', 'qty_available', 'incoming_qty'],
        limit: 5
      }
    );

    if (!products || products.length === 0) {
      console.log('❌ Prodotto non trovato');
      return;
    }

    const product = products[0];
    console.log('✅ Prodotto trovato:');
    console.log(`   ID: ${product.id}`);
    console.log(`   Nome: ${product.name}`);
    console.log(`   Qty disponibile: ${product.qty_available}`);
    console.log(`   Qty in arrivo: ${product.incoming_qty}`);

    // 2. Cerca stock.move per questo prodotto
    console.log('\n📦 STEP 2: Cerca stock.move in ingresso...');

    // Prima prova: cerca TUTTI i move in ingresso
    const allMoves = await call(uid, 'stock.move', 'search_read',
      [
        ['product_id', '=', product.id],
        ['state', 'in', ['waiting', 'confirmed', 'assigned', 'partially_available']]
      ],
      {
        fields: ['id', 'name', 'product_id', 'state', 'date', 'date_deadline', 'picking_id', 'picking_code', 'location_id', 'location_dest_id'],
        limit: 20
      }
    );

    console.log(`✅ Trovati ${allMoves?.length || 0} movimenti in stato waiting/confirmed/assigned`);

    if (allMoves && allMoves.length > 0) {
      console.log('\n📋 DETTAGLIO MOVIMENTI:');
      allMoves.forEach((move, idx) => {
        console.log(`\n   Movimento ${idx + 1}:`);
        console.log(`   - ID: ${move.id}`);
        console.log(`   - Nome: ${move.name}`);
        console.log(`   - State: ${move.state}`);
        console.log(`   - Date: ${move.date}`);
        console.log(`   - Date Deadline: ${move.date_deadline}`);
        console.log(`   - Picking Code: ${move.picking_code}`);
        console.log(`   - Picking ID: ${move.picking_id ? move.picking_id[1] : 'N/A'}`);
        console.log(`   - Location ID: ${move.location_id ? move.location_id[1] : 'N/A'}`);
        console.log(`   - Location Dest ID: ${move.location_dest_id ? move.location_dest_id[1] : 'N/A'}`);
      });
    }

    // 3. Cerca anche con picking_type_id (tipo di operazione)
    console.log('\n📦 STEP 3: Cerca stock.picking per questo prodotto...');
    const pickings = await call(uid, 'stock.picking', 'search_read',
      [
        ['state', 'in', ['waiting', 'confirmed', 'assigned', 'partially_available']],
        ['picking_type_code', '=', 'incoming']
      ],
      {
        fields: ['id', 'name', 'partner_id', 'scheduled_date', 'date_deadline', 'state', 'picking_type_code', 'move_ids_without_package'],
        limit: 10
      }
    );

    console.log(`✅ Trovati ${pickings?.length || 0} picking in ingresso`);

    if (pickings && pickings.length > 0) {
      console.log('\n📋 DETTAGLIO PICKING:');
      for (const picking of pickings) {
        // Verifica se questo picking contiene il nostro prodotto
        if (picking.move_ids_without_package && picking.move_ids_without_package.length > 0) {
          const moves = await call(uid, 'stock.move', 'search_read',
            [
              ['id', 'in', picking.move_ids_without_package],
              ['product_id', '=', product.id]
            ],
            {
              fields: ['id', 'product_id', 'date', 'date_deadline'],
              limit: 5
            }
          );

          if (moves && moves.length > 0) {
            console.log(`\n   Picking: ${picking.name}`);
            console.log(`   - Partner: ${picking.partner_id ? picking.partner_id[1] : 'N/A'}`);
            console.log(`   - Scheduled Date: ${picking.scheduled_date}`);
            console.log(`   - Date Deadline: ${picking.date_deadline}`);
            console.log(`   - State: ${picking.state}`);
            console.log(`   - Contiene ${moves.length} move del nostro prodotto`);
            moves.forEach(move => {
              console.log(`      • Move Date: ${move.date}`);
              console.log(`      • Move Deadline: ${move.date_deadline}`);
            });
          }
        }
      }
    }

    // 4. Verifica purchase.order.line
    console.log('\n📦 STEP 4: Cerca ordini di acquisto...');
    const poLines = await call(uid, 'purchase.order.line', 'search_read',
      [
        ['product_id', '=', product.id],
        ['state', 'in', ['purchase', 'done']]
      ],
      {
        fields: ['id', 'order_id', 'product_id', 'product_qty', 'qty_received', 'date_planned', 'state'],
        order: 'date_planned ASC',
        limit: 10
      }
    );

    console.log(`✅ Trovati ${poLines?.length || 0} righe ordini acquisto`);

    if (poLines && poLines.length > 0) {
      console.log('\n📋 DETTAGLIO ORDINI ACQUISTO:');
      poLines.forEach((line, idx) => {
        console.log(`\n   Riga ${idx + 1}:`);
        console.log(`   - Ordine: ${line.order_id ? line.order_id[1] : 'N/A'}`);
        console.log(`   - Qty ordinata: ${line.product_qty}`);
        console.log(`   - Qty ricevuta: ${line.qty_received}`);
        console.log(`   - Data pianificata: ${line.date_planned}`);
        console.log(`   - State: ${line.state}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Verifica completata');

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

verificaIncomingDate();
