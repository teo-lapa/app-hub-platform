/**
 * Esplorazione: Come sono collegati i prodotti nel furgone agli ordini di vendita?
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859';

async function login() {
  const resp = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: 'paul@lapa.ch', password: 'lapa201180' },
      id: 1
    })
  });

  const cookies = resp.headers.get('set-cookie') || '';
  const match = cookies.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
}

async function odooCall(sessionId, model, method, args, kwargs = {}) {
  const resp = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.random()
    })
  });

  const data = await resp.json();
  if (data.error) {
    console.error('❌ Errore:', data.error.data.message);
    return null;
  }
  return data.result;
}

async function exploreStockMoves(sessionId) {
  console.log('\n📦 STEP 1: Cerco STOCK MOVES nella ubicazione Furgoni...\n');

  // Cerca stock.move con destination = furgoni
  const moves = await odooCall(sessionId, 'stock.move', 'search_read', [[
    ['location_dest_id', '=', 11], // Furgoni location ID
    ['state', 'in', ['assigned', 'done']]
  ]], {
    fields: ['id', 'name', 'product_id', 'product_uom_qty', 'sale_line_id', 'picking_id', 'state', 'origin'],
    limit: 10
  });

  if (!moves || moves.length === 0) {
    console.log('❌ Nessun stock move trovato in Furgoni');
    return;
  }

  console.log(`✅ Trovati ${moves.length} stock moves:\n`);

  for (const move of moves) {
    console.log(`\n📦 Move: ${move.name}`);
    console.log(`   Prodotto: ${move.product_id[1]}`);
    console.log(`   Qtà: ${move.product_uom_qty}`);
    console.log(`   Stato: ${move.state}`);
    console.log(`   Origin: ${move.origin || 'N/A'}`);
    console.log(`   Picking: ${move.picking_id ? move.picking_id[1] : 'N/A'}`);
    console.log(`   Sale Line ID: ${move.sale_line_id ? move.sale_line_id[0] : 'N/A'}`);

    // Se ha sale_line_id, recupera l'ordine
    if (move.sale_line_id) {
      const saleLine = await odooCall(sessionId, 'sale.order.line', 'read', [[move.sale_line_id[0]], ['order_id', 'product_uom_qty']]);

      if (saleLine && saleLine[0]) {
        const orderId = saleLine[0].order_id[0];
        const order = await odooCall(sessionId, 'sale.order', 'read', [[orderId], ['name', 'partner_id', 'commitment_date', 'date_order']]);

        if (order && order[0]) {
          console.log(`\n   🎯 COLLEGATO A ORDINE:`);
          console.log(`      Ordine: ${order[0].name}`);
          console.log(`      Cliente: ${order[0].partner_id[1]}`);
          console.log(`      Data consegna: ${order[0].commitment_date || order[0].date_order || 'N/A'}`);
        }
      }
    }
  }
}

async function exploreStockMoveLine(sessionId) {
  console.log('\n\n📋 STEP 2: Cerco STOCK MOVE LINES (dettaglio con lotti)...\n');

  const moveLines = await odooCall(sessionId, 'stock.move.line', 'search_read', [[
    ['location_dest_id', '=', 11],
    ['state', 'in', ['assigned', 'done']]
  ]], {
    fields: ['id', 'move_id', 'product_id', 'qty_done', 'lot_id', 'picking_id'],
    limit: 10
  });

  if (!moveLines || moveLines.length === 0) {
    console.log('❌ Nessun move line trovato');
    return;
  }

  console.log(`✅ Trovati ${moveLines.length} move lines:\n`);

  for (const ml of moveLines) {
    console.log(`\n📋 Move Line: ${ml.id}`);
    console.log(`   Prodotto: ${ml.product_id[1]}`);
    console.log(`   Qtà: ${ml.qty_done}`);
    console.log(`   Lotto: ${ml.lot_id ? ml.lot_id[1] : 'N/A'}`);
    console.log(`   Picking: ${ml.picking_id ? ml.picking_id[1] : 'N/A'}`);

    if (ml.move_id) {
      const move = await odooCall(sessionId, 'stock.move', 'read', [[ml.move_id[0]], ['sale_line_id', 'origin']]);
      if (move && move[0] && move[0].sale_line_id) {
        console.log(`   ✅ Ha sale_line_id: ${move[0].sale_line_id[0]}`);
      }
    }
  }
}

async function main() {
  const sid = await login();
  console.log('✅ Login OK\n');

  await exploreStockMoves(sid);
  await exploreStockMoveLine(sid);

  console.log('\n\n💡 CONCLUSIONE:');
  console.log('   - I prodotti nel furgone sono collegati tramite stock.move');
  console.log('   - stock.move ha sale_line_id che punta a sale.order.line');
  console.log('   - Da sale.order.line risalgo a sale.order per avere cliente e data\n');
}

main();
