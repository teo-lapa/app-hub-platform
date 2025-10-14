/**
 * Script per testare la tracciabilità lotto -> ordine -> cliente
 *
 * Percorso dati:
 * stock.lot -> stock.move.line -> stock.move -> stock.picking -> sale.order
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const LOT_NAME = 'FPI060825'; // Lotto dalle screenshot

async function odooCall(sessionId, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        method: method,
        args: args,
        kwargs: kwargs
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Odoo Error: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function testLotTraceability(sessionId) {
  console.log('\n🔍 ===== TEST TRACCIABILITÀ LOTTO =====\n');
  console.log(`Lotto da tracciare: ${LOT_NAME}\n`);

  try {
    // STEP 1: Trova il lotto
    console.log('📦 STEP 1: Ricerca lotto...');
    const lots = await odooCall(sessionId, 'stock.lot', 'search_read',
      [[['name', '=', LOT_NAME]]],
      { fields: ['id', 'name', 'product_id', 'expiration_date'] }
    );

    if (lots.length === 0) {
      console.log(`❌ Lotto "${LOT_NAME}" non trovato!`);
      return;
    }

    const lot = lots[0];
    console.log('✅ Lotto trovato:', {
      id: lot.id,
      name: lot.name,
      product: lot.product_id[1],
      product_id: lot.product_id[0],
      expiry: lot.expiration_date
    });

    // STEP 2: Trova stock.quant per vedere dove si trova il lotto
    console.log('\n📍 STEP 2: Verifica ubicazioni lotto...');
    const quants = await odooCall(sessionId, 'stock.quant', 'search_read',
      [[['lot_id', '=', lot.id], ['quantity', '>', 0]]],
      { fields: ['location_id', 'quantity', 'reserved_quantity'] }
    );

    console.log(`✅ Trovate ${quants.length} ubicazioni con questo lotto:`);
    quants.forEach(q => {
      console.log(`   - ${q.location_id[1]}: ${q.quantity} unità (riservate: ${q.reserved_quantity || 0})`);
    });

    // STEP 3: Trova stock.move.line (operazioni con questo lotto)
    console.log('\n🚚 STEP 3: Ricerca movimenti con questo lotto...');
    const moveLines = await odooCall(sessionId, 'stock.move.line', 'search_read',
      [[['lot_id', '=', lot.id], ['state', 'in', ['assigned', 'done']]]],
      {
        fields: ['id', 'move_id', 'picking_id', 'location_dest_id', 'qty_done', 'state'],
        limit: 10
      }
    );

    console.log(`✅ Trovati ${moveLines.length} movimenti dettagliati:`);

    if (moveLines.length === 0) {
      console.log('⚠️ Nessun movimento trovato per questo lotto.');
      return;
    }

    // STEP 4: Per ogni move.line, risali al picking e all'ordine
    console.log('\n📋 STEP 4: Tracciamento picking -> ordine -> cliente...\n');

    const results = [];

    for (const ml of moveLines.slice(0, 5)) { // Prendi max 5 risultati
      console.log(`\n  🔗 Move Line ID ${ml.id}:`);
      console.log(`     - Destinazione: ${ml.location_dest_id[1]}`);
      console.log(`     - Quantità: ${ml.qty_done}`);
      console.log(`     - Stato: ${ml.state}`);

      // Carica stock.move per ottenere sale_line_id
      if (ml.move_id) {
        const moves = await odooCall(sessionId, 'stock.move', 'read',
          [[ml.move_id[0]]],
          { fields: ['id', 'name', 'origin', 'sale_line_id', 'picking_id'] }
        );

        const move = moves[0];
        console.log(`     - Move: ${move.name}`);
        console.log(`     - Origin: ${move.origin || 'N/A'}`);

        // Carica picking
        if (ml.picking_id) {
          const pickings = await odooCall(sessionId, 'stock.picking', 'read',
            [[ml.picking_id[0]]],
            { fields: ['name', 'origin', 'partner_id', 'scheduled_date', 'date_done', 'state'] }
          );

          const picking = pickings[0];
          console.log(`     - Picking: ${picking.name}`);
          console.log(`     - Picking Origin: ${picking.origin || 'N/A'}`);
          console.log(`     - Cliente: ${picking.partner_id ? picking.partner_id[1] : 'N/A'}`);
          console.log(`     - Data prevista: ${picking.scheduled_date || 'N/A'}`);

          // STEP 5: Cerca il sale.order tramite origin
          if (picking.origin) {
            console.log(`\n     🎯 Ricerca ordine di vendita "${picking.origin}"...`);

            const orders = await odooCall(sessionId, 'sale.order', 'search_read',
              [[['name', '=', picking.origin]]],
              { fields: ['id', 'name', 'partner_id', 'commitment_date', 'date_order', 'state'] }
            );

            if (orders.length > 0) {
              const order = orders[0];
              console.log(`     ✅ ORDINE TROVATO:`);
              console.log(`        - Numero: ${order.name}`);
              console.log(`        - Cliente: ${order.partner_id[1]}`);
              console.log(`        - Data consegna: ${order.commitment_date || order.date_order}`);
              console.log(`        - Stato: ${order.state}`);

              results.push({
                lotName: lot.name,
                productName: lot.product_id[1],
                orderNumber: order.name,
                customerName: order.partner_id[1],
                deliveryDate: order.commitment_date || order.date_order,
                pickingName: picking.name,
                quantity: ml.qty_done
              });
            } else {
              console.log(`     ⚠️ Ordine "${picking.origin}" non trovato in sale.order`);
            }
          }

          // STEP 6: Fallback - usa sale_line_id se disponibile
          if (move.sale_line_id && move.sale_line_id[0]) {
            console.log(`\n     🔗 Metodo alternativo: sale_line_id presente...`);

            const saleLines = await odooCall(sessionId, 'sale.order.line', 'read',
              [[move.sale_line_id[0]]],
              { fields: ['order_id'] }
            );

            if (saleLines.length > 0) {
              const orderId = saleLines[0].order_id[0];

              const orders = await odooCall(sessionId, 'sale.order', 'read',
                [[orderId]],
                { fields: ['name', 'partner_id', 'commitment_date', 'date_order'] }
              );

              if (orders.length > 0) {
                const order = orders[0];
                console.log(`     ✅ ORDINE TRAMITE SALE_LINE:`);
                console.log(`        - Numero: ${order.name}`);
                console.log(`        - Cliente: ${order.partner_id[1]}`);
                console.log(`        - Data consegna: ${order.commitment_date || order.date_order}`);

                // Aggiungi solo se non già presente
                const exists = results.some(r => r.orderNumber === order.name);
                if (!exists) {
                  results.push({
                    lotName: lot.name,
                    productName: lot.product_id[1],
                    orderNumber: order.name,
                    customerName: order.partner_id[1],
                    deliveryDate: order.commitment_date || order.date_order,
                    pickingName: picking.name,
                    quantity: ml.qty_done,
                    method: 'via sale_line_id'
                  });
                }
              }
            }
          }
        }
      }
    }

    // RISULTATI FINALI
    console.log('\n\n📊 ===== RISULTATI TRACCIABILITÀ =====\n');

    if (results.length === 0) {
      console.log('⚠️ Nessun ordine di vendita trovato per questo lotto.');
      console.log('   Possibili motivi:');
      console.log('   - Il lotto non è stato ancora spedito');
      console.log('   - Il lotto proviene da un trasferimento interno');
      console.log('   - Il campo "origin" del picking non corrisponde a un ordine');
    } else {
      console.log(`✅ Trovati ${results.length} ordini collegati al lotto "${LOT_NAME}":\n`);

      results.forEach((r, i) => {
        console.log(`${i + 1}. Ordine: ${r.orderNumber}`);
        console.log(`   Cliente: ${r.customerName}`);
        console.log(`   Data consegna: ${r.deliveryDate}`);
        console.log(`   Picking: ${r.pickingName}`);
        console.log(`   Quantità: ${r.quantity}`);
        if (r.method) console.log(`   Metodo: ${r.method}`);
        console.log('');
      });

      // Suggerimento per il codice
      console.log('\n💡 SUGGERIMENTO PER IL CODICE:');
      console.log('   Per ottenere ordini da un lotto, usa questo percorso:');
      console.log('   1. stock.lot.search_read([["name", "=", LOT_NAME]])');
      console.log('   2. stock.move.line.search_read([["lot_id", "=", lot_id], ["state", "in", ["assigned", "done"]]])');
      console.log('   3. stock.picking.read([picking_id], ["origin", "partner_id", "scheduled_date"])');
      console.log('   4. sale.order.search_read([["name", "=", picking.origin]])');
      console.log('   5. Fallback: usa sale_line_id se disponibile in stock.move');
    }

  } catch (error) {
    console.error('❌ Errore durante il test:', error);
    throw error;
  }
}

// Esegui il test
(async () => {
  // Leggi session_id da cookie (devi essere loggato)
  const sessionId = process.argv[2];

  if (!sessionId) {
    console.error('❌ Errore: devi fornire il session_id come argomento');
    console.log('\nUso: node test-lot-traceability.js <session_id>');
    console.log('\nPer ottenere il session_id:');
    console.log('1. Apri Chrome DevTools (F12)');
    console.log('2. Vai in Application > Cookies');
    console.log('3. Cerca il cookie "session_id" o "odoo_session_id"');
    console.log('4. Copia il valore');
    process.exit(1);
  }

  try {
    await testLotTraceability(sessionId);
  } catch (error) {
    console.error('\n❌ Test fallito:', error.message);
    process.exit(1);
  }
})();
