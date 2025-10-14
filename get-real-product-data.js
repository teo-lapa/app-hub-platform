/**
 * Prendo UN prodotto dal furgone e trovo TUTTI i suoi dati collegati agli ordini
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

async function call(sid, model, method, args, fields) {
  const resp = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sid}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs: { fields } },
      id: Math.random()
    })
  });
  const data = await resp.json();
  return data.result || [];
}

async function main() {
  const sid = await login();
  console.log('✅ Login OK\n');

  // Prodotto: GORGONZOLA DOP SANGIORGIO
  const PRODUCT_NAME = 'GORGONZOLA DOP SANGIORGIO EXP.4 VASC. 1/8 TS PZ CA 1.5KG AUR';

  console.log(`🔍 Cerco il prodotto: ${PRODUCT_NAME}\n`);

  // 1. Trova il prodotto
  const products = await call(sid, 'product.product', 'search_read', [[['name', '=', PRODUCT_NAME]]], ['id', 'name']);
  if (!products.length) {
    console.log('❌ Prodotto non trovato');
    return;
  }
  const productId = products[0].id;
  console.log(`✅ Prodotto ID: ${productId}\n`);

  // 2. Trova quants nel furgone (location 11)
  console.log('📦 Cerco quants nel furgone...');
  const quants = await call(sid, 'stock.quant', 'search_read', [[['product_id', '=', productId], ['location_id', '=', 11]]], ['quantity', 'reserved_quantity', 'lot_id']);
  console.log(`Quantità nel furgone: ${quants[0]?.quantity || 0}\n`);

  // 3. Trova stock.move collegati
  console.log('📋 Cerco stock.move per questo prodotto nel furgone...');
  const moves = await call(sid, 'stock.move', 'search_read', [[['product_id', '=', productId], ['location_dest_id', '=', 11], ['state', 'in', ['assigned', 'done']]]], ['id', 'name', 'product_uom_qty', 'origin', 'sale_line_id', 'picking_id', 'state']);

  console.log(`\nTrovati ${moves.length} stock.move:\n`);

  for (const move of moves) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Move ID: ${move.id}`);
    console.log(`Quantità: ${move.product_uom_qty}`);
    console.log(`Stato: ${move.state}`);
    console.log(`Origin: ${move.origin || 'N/A'}`);
    console.log(`Sale Line ID: ${move.sale_line_id ? move.sale_line_id[0] : 'N/A'}`);
    console.log(`Picking: ${move.picking_id ? move.picking_id[1] : 'N/A'}`);

    // Se ha sale_line_id, risali all'ordine
    if (move.sale_line_id) {
      const saleLineId = move.sale_line_id[0];
      const saleLines = await call(sid, 'sale.order.line', 'read', [[saleLineId]], ['order_id', 'product_uom_qty']);

      if (saleLines.length) {
        const orderId = saleLines[0].order_id[0];
        const orders = await call(sid, 'sale.order', 'read', [[orderId]], ['name', 'partner_id', 'commitment_date', 'date_order', 'amount_total']);

        if (orders.length) {
          const order = orders[0];
          console.log(`\n🎯 ORDINE COLLEGATO:`);
          console.log(`   Numero: ${order.name}`);
          console.log(`   Cliente: ${order.partner_id[1]}`);
          console.log(`   Data consegna: ${order.commitment_date || order.date_order}`);
          console.log(`   Totale: €${order.amount_total}`);
        }
      }
    } else if (move.origin) {
      // Prova a cercare l'ordine tramite origin
      const orders = await call(sid, 'sale.order', 'search_read', [[['name', '=', move.origin]]], ['name', 'partner_id', 'commitment_date', 'date_order']);
      if (orders.length) {
        const order = orders[0];
        console.log(`\n🎯 ORDINE DA ORIGIN:`);
        console.log(`   Numero: ${order.name}`);
        console.log(`   Cliente: ${order.partner_id[1]}`);
        console.log(`   Data consegna: ${order.commitment_date || order.date_order}`);
      }
    }
    console.log('');
  }

  console.log('\n\n💡 RISULTATO:');
  console.log('   Ora ho TUTTI i dati reali per mostrare gli ordini collegati!\n');
}

main();
