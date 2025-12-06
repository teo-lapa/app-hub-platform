// Script per investigazione più approfondita su omaggi, rettifiche, resi
const ODOO_URL = "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com";
const ODOO_DB = "lapadevadmin-lapa-v2-main-7268478";
const ODOO_USER = "apphubplatform@lapa.ch";
const ODOO_PASSWORD = "apphubplatform2025";

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USER, password: ODOO_PASSWORD },
      id: 1,
    }),
  });
  const data = await response.json();
  const cookies = response.headers.get('set-cookie');
  const sessionId = cookies?.match(/session_id=([^;]+)/)?.[1];
  return { sessionId, uid: data.result?.uid };
}

async function callKw(sessionId, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: 2,
    }),
  });
  const data = await response.json();
  if (data.error) return null;
  return data.result;
}

async function investigate(sessionId) {
  console.log("=== INVESTIGAZIONE APPROFONDITA ===\n");

  // 1. Tipi di movimenti stock (per capire cosa causa discrepanze)
  console.log("1. TIPI DI MOVIMENTI STOCK (stock.picking.type)...");
  const pickingTypes = await callKw(sessionId, 'stock.picking.type', 'search_read', [
    [],
    ['id', 'name', 'code', 'sequence_code', 'warehouse_id']
  ], { limit: 20 });
  console.log("Tipi di picking disponibili:");
  pickingTypes?.forEach(pt => {
    console.log(`  - [${pt.id}] ${pt.name} (code: ${pt.code})`);
  });

  // 2. Locations virtuali (per capire le rettifiche)
  console.log("\n2. UBICAZIONI VIRTUALI (stock.location)...");
  const virtualLocations = await callKw(sessionId, 'stock.location', 'search_read', [
    [['usage', 'in', ['inventory', 'production', 'transit', 'customer', 'supplier']]],
    ['id', 'name', 'complete_name', 'usage']
  ], { limit: 20 });
  console.log("Ubicazioni speciali:");
  virtualLocations?.forEach(l => {
    console.log(`  - [${l.id}] ${l.complete_name} (${l.usage})`);
  });

  // 3. Movimenti di rettifica inventario
  console.log("\n3. MOVIMENTI RETTIFICA INVENTARIO (ultimi 30gg)...");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const inventoryMoves = await callKw(sessionId, 'stock.move', 'search_read', [
    [
      ['state', '=', 'done'],
      ['date', '>=', thirtyDaysAgo],
      '|',
      ['location_id.usage', '=', 'inventory'],
      ['location_dest_id.usage', '=', 'inventory']
    ],
    ['id', 'product_id', 'quantity', 'location_id', 'location_dest_id', 'date', 'origin', 'reference']
  ], { limit: 30, order: 'date desc' });
  console.log(`Trovati ${inventoryMoves?.length || 0} movimenti di rettifica inventario`);
  if (inventoryMoves && inventoryMoves.length > 0) {
    console.log("\nEsempi:");
    inventoryMoves.slice(0, 5).forEach(m => {
      console.log(`  - ${m.date}: ${m.product_id[1]}`);
      console.log(`    ${m.quantity} unità: ${m.location_id[1]} -> ${m.location_dest_id[1]}`);
    });
  }

  // 4. Analisi omaggi dettagliata con info ordine
  console.log("\n4. ANALISI OMAGGI DETTAGLIATA...");
  const omaggi = await callKw(sessionId, 'sale.order.line', 'search_read', [
    [['discount', '=', 100]],
    ['id', 'order_id', 'product_id', 'product_uom_qty', 'qty_delivered', 'price_unit', 'discount', 'state', 'is_reward_line']
  ], { limit: 20, order: 'id desc' });

  console.log(`Trovati ${omaggi?.length || 0} omaggi totali`);

  // Separa omaggi manuali da reward automatici
  const omaggiReward = omaggi?.filter(o => o.is_reward_line) || [];
  const omaggiManuali = omaggi?.filter(o => !o.is_reward_line) || [];

  console.log(`  - Reward automatici (promozioni): ${omaggiReward.length}`);
  console.log(`  - Omaggi manuali (sconto 100%): ${omaggiManuali.length}`);

  if (omaggiManuali.length > 0) {
    console.log("\nEsempi omaggi manuali:");
    omaggiManuali.slice(0, 3).forEach(o => {
      console.log(`  - Ordine: ${o.order_id[1]}`);
      console.log(`    Prodotto: ${o.product_id[1]}`);
      console.log(`    Qty: ${o.product_uom_qty}, Consegnati: ${o.qty_delivered}`);
    });
  }

  // 5. Resi clienti (stock.picking con return nel nome o origin)
  console.log("\n5. RESI CLIENTI (stock.picking)...");
  const resiPickings = await callKw(sessionId, 'stock.picking', 'search_read', [
    [
      ['state', '=', 'done'],
      '|', '|',
      ['name', 'ilike', 'return'],
      ['origin', 'ilike', 'return'],
      ['picking_type_id.code', '=', 'incoming']
    ],
    ['id', 'name', 'partner_id', 'origin', 'date_done', 'picking_type_id']
  ], { limit: 20, order: 'date_done desc' });
  console.log(`Trovati ${resiPickings?.length || 0} possibili resi`);
  if (resiPickings && resiPickings.length > 0) {
    resiPickings.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name}: ${p.partner_id?.[1] || 'N/A'} - ${p.origin || 'no origin'}`);
    });
  }

  // 6. Account move (per capire note credito / rettifiche contabili)
  console.log("\n6. NOTE CREDITO (account.move)...");
  const creditNotes = await callKw(sessionId, 'account.move', 'search_read', [
    [['move_type', '=', 'out_refund'], ['state', '=', 'posted']],
    ['id', 'name', 'partner_id', 'invoice_date', 'amount_total', 'ref']
  ], { limit: 10, order: 'invoice_date desc' });
  console.log(`Trovate ${creditNotes?.length || 0} note credito`);
  if (creditNotes && creditNotes.length > 0) {
    creditNotes.slice(0, 3).forEach(cn => {
      console.log(`  - ${cn.name}: ${cn.partner_id?.[1]} - CHF ${cn.amount_total}`);
    });
  }

  // 7. Scarti / scrap
  console.log("\n7. SCARTI (stock.scrap)...");
  const scraps = await callKw(sessionId, 'stock.scrap', 'search_read', [
    [['state', '=', 'done']],
    ['id', 'name', 'product_id', 'scrap_qty', 'date_done', 'origin']
  ], { limit: 10, order: 'date_done desc' });
  console.log(`Trovati ${scraps?.length || 0} scarti registrati`);
  if (scraps && scraps.length > 0) {
    scraps.slice(0, 3).forEach(s => {
      console.log(`  - ${s.date_done}: ${s.product_id[1]} - qty: ${s.scrap_qty}`);
    });
  }

  // 8. Fornitori di un prodotto specifico
  console.log("\n8. FORNITORI PER PRODOTTO (product.supplierinfo)...");
  const supplierInfos = await callKw(sessionId, 'product.supplierinfo', 'search_read', [
    [],
    ['id', 'product_tmpl_id', 'partner_id', 'price', 'min_qty', 'delay', 'date_start', 'date_end']
  ], { limit: 20 });
  console.log(`Trovati ${supplierInfos?.length || 0} info fornitori`);
  if (supplierInfos && supplierInfos.length > 0) {
    console.log("Campi disponibili:", Object.keys(supplierInfos[0]));
    console.log("Esempio:", JSON.stringify(supplierInfos[0], null, 2));
  }

  // 9. Verifica campi product.product per tracking fornitori
  console.log("\n9. CAMPI PRODOTTO PER FORNITORI...");
  const productFields = await callKw(sessionId, 'product.product', 'fields_get', [], { attributes: ['string', 'type'] });
  const supplierFields = ['seller_ids', 'variant_seller_ids', 'supplier_taxes_id'];
  console.log("Campi fornitore in product.product:");
  supplierFields.forEach(f => {
    if (productFields && productFields[f]) {
      console.log(`  - ${f}: ${productFields[f].string} (${productFields[f].type})`);
    }
  });

  // 10. Test ricerca prodotto completa
  console.log("\n10. TEST RICERCA PRODOTTO COMPLETA...");
  const searchTest = await callKw(sessionId, 'product.product', 'search_read', [
    [['name', 'ilike', 'latte']],
    ['id', 'name', 'default_code', 'barcode', 'categ_id', 'qty_available', 'list_price', 'standard_price', 'seller_ids']
  ], { limit: 5 });
  console.log(`Trovati ${searchTest?.length || 0} prodotti con 'latte'`);
  if (searchTest && searchTest.length > 0) {
    console.log("Esempio prodotto con seller_ids:", JSON.stringify(searchTest[0], null, 2));
  }

  // 11. Calcolo margine e profitto per prodotto
  console.log("\n11. VERIFICA CAMPI PER CALCOLO PROFITTO...");
  const saleLineFields = await callKw(sessionId, 'sale.order.line', 'fields_get', [], { attributes: ['string', 'type'] });
  const profitFields = ['margin', 'margin_percent', 'purchase_price', 'price_reduce', 'price_total', 'price_subtotal', 'untaxed_amount_to_invoice'];
  console.log("Campi profitto in sale.order.line:");
  profitFields.forEach(f => {
    if (saleLineFields && saleLineFields[f]) {
      console.log(`  - ${f}: ${saleLineFields[f].string} (${saleLineFields[f].type})`);
    }
  });

  // 12. Test con riga vendita con margine
  console.log("\n12. TEST RIGA VENDITA CON MARGINE...");
  const saleLineWithMargin = await callKw(sessionId, 'sale.order.line', 'search_read', [
    [['state', '=', 'sale']],
    ['id', 'order_id', 'product_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'purchase_price', 'margin', 'margin_percent']
  ], { limit: 3, order: 'id desc' });
  console.log("Righe vendita con info margine:");
  saleLineWithMargin?.forEach(l => {
    console.log(`  - ${l.product_id[1]}`);
    console.log(`    Prezzo: ${l.price_unit}, Costo: ${l.purchase_price}`);
    console.log(`    Margine: ${l.margin} (${l.margin_percent}%)`);
  });

  console.log("\n=== INVESTIGAZIONE COMPLETATA ===");
}

async function main() {
  const { sessionId, uid } = await authenticate();
  if (!sessionId || !uid) {
    console.error("Autenticazione fallita!");
    return;
  }
  console.log("Autenticato come UID:", uid, "\n");
  await investigate(sessionId);
}

main();
