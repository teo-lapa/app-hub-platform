// Script per investigare la struttura dati Odoo per Product History
// Usa le credenziali staging per esplorare i modelli

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
      params: {
        db: ODOO_DB,
        login: ODOO_USER,
        password: ODOO_PASSWORD,
      },
      id: 1,
    }),
  });

  const data = await response.json();
  const cookies = response.headers.get('set-cookie');
  const sessionId = cookies?.match(/session_id=([^;]+)/)?.[1];

  console.log("=== AUTENTICAZIONE ===");
  console.log("UID:", data.result?.uid);
  console.log("Session ID:", sessionId ? "OK" : "FALLITO");

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
      params: {
        model,
        method,
        args,
        kwargs,
      },
      id: 2,
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error(`Errore ${model}.${method}:`, data.error.data?.message || data.error);
    return null;
  }
  return data.result;
}

async function investigateProductData(sessionId) {
  console.log("\n=== INVESTIGAZIONE STRUTTURA DATI PRODOTTO ===\n");

  // 1. Trova un prodotto di esempio
  console.log("1. CERCO UN PRODOTTO DI ESEMPIO...");
  const products = await callKw(sessionId, 'product.product', 'search_read', [
    [['type', '=', 'product'], ['qty_available', '>', 0]],  // Prodotti fisici con giacenza
    ['id', 'name', 'default_code', 'barcode', 'qty_available', 'virtual_available', 'incoming_qty', 'outgoing_qty', 'standard_price', 'list_price']
  ], { limit: 3 });

  if (!products || products.length === 0) {
    console.log("Nessun prodotto trovato con giacenza > 0");
    return;
  }

  console.log("\nProdotti trovati:");
  products.forEach(p => {
    console.log(`  - [${p.id}] ${p.name} (${p.default_code || 'no code'})`);
    console.log(`    Giacenza: ${p.qty_available}, Virtuale: ${p.virtual_available}`);
    console.log(`    Prezzo costo: ${p.standard_price}, Prezzo listino: ${p.list_price}`);
  });

  const testProduct = products[0];
  console.log(`\n>>> Uso prodotto: ${testProduct.name} (ID: ${testProduct.id})`);

  // 2. ACQUISTI - purchase.order.line
  console.log("\n2. STORICO ACQUISTI (purchase.order.line)...");
  const purchaseLines = await callKw(sessionId, 'purchase.order.line', 'search_read', [
    [['product_id', '=', testProduct.id]],
    ['id', 'order_id', 'product_id', 'product_qty', 'qty_received', 'price_unit', 'price_subtotal', 'date_planned', 'state']
  ], { limit: 10, order: 'id desc' });

  console.log(`Trovate ${purchaseLines?.length || 0} righe acquisto`);
  if (purchaseLines && purchaseLines.length > 0) {
    console.log("Campi disponibili:", Object.keys(purchaseLines[0]));
    console.log("Esempio riga:", JSON.stringify(purchaseLines[0], null, 2));

    // Ottieni info ordine
    const orderIds = [...new Set(purchaseLines.map(l => l.order_id[0]))];
    const orders = await callKw(sessionId, 'purchase.order', 'search_read', [
      [['id', 'in', orderIds]],
      ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state']
    ]);
    console.log("\nOrdini acquisto correlati:");
    orders?.forEach(o => {
      console.log(`  - ${o.name} da ${o.partner_id[1]} - ${o.date_order} - Stato: ${o.state}`);
    });
  }

  // 3. VENDITE - sale.order.line
  console.log("\n3. STORICO VENDITE (sale.order.line)...");
  const saleLines = await callKw(sessionId, 'sale.order.line', 'search_read', [
    [['product_id', '=', testProduct.id]],
    ['id', 'order_id', 'product_id', 'product_uom_qty', 'qty_delivered', 'qty_invoiced', 'price_unit', 'price_subtotal', 'discount', 'state']
  ], { limit: 10, order: 'id desc' });

  console.log(`Trovate ${saleLines?.length || 0} righe vendita`);
  if (saleLines && saleLines.length > 0) {
    console.log("Campi disponibili:", Object.keys(saleLines[0]));
    console.log("Esempio riga:", JSON.stringify(saleLines[0], null, 2));

    // Cerca OMAGGI (sconto 100%)
    const omaggi = saleLines.filter(l => l.discount === 100);
    console.log(`\n*** OMAGGI (sconto 100%): ${omaggi.length} righe ***`);
    if (omaggi.length > 0) {
      console.log("Esempio omaggio:", JSON.stringify(omaggi[0], null, 2));
    }

    // Ottieni info ordini vendita
    const saleOrderIds = [...new Set(saleLines.map(l => l.order_id[0]))];
    const saleOrders = await callKw(sessionId, 'sale.order', 'search_read', [
      [['id', 'in', saleOrderIds]],
      ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state', 'user_id']
    ]);
    console.log("\nOrdini vendita correlati:");
    saleOrders?.forEach(o => {
      console.log(`  - ${o.name} a ${o.partner_id[1]} - ${o.date_order} - Stato: ${o.state}`);
    });
  }

  // 4. MOVIMENTI STOCK - stock.move
  console.log("\n4. MOVIMENTI MAGAZZINO (stock.move)...");
  const stockMoves = await callKw(sessionId, 'stock.move', 'search_read', [
    [['product_id', '=', testProduct.id], ['state', '=', 'done']],
    ['id', 'name', 'product_id', 'product_uom_qty', 'quantity', 'location_id', 'location_dest_id', 'date', 'origin', 'state', 'picking_id', 'reference']
  ], { limit: 20, order: 'date desc' });

  console.log(`Trovati ${stockMoves?.length || 0} movimenti completati`);
  if (stockMoves && stockMoves.length > 0) {
    console.log("Campi disponibili:", Object.keys(stockMoves[0]));
    console.log("\nUltimi movimenti:");
    stockMoves.slice(0, 5).forEach(m => {
      console.log(`  - ${m.date}: ${m.quantity} unità`);
      console.log(`    Da: ${m.location_id[1]} -> A: ${m.location_dest_id[1]}`);
      console.log(`    Origine: ${m.origin || m.reference || 'N/A'}`);
    });
  }

  // 5. GIACENZA PER LOCATION - stock.quant
  console.log("\n5. GIACENZA PER UBICAZIONE (stock.quant)...");
  const quants = await callKw(sessionId, 'stock.quant', 'search_read', [
    [['product_id', '=', testProduct.id], ['quantity', '!=', 0]],
    ['id', 'product_id', 'location_id', 'quantity', 'reserved_quantity', 'lot_id', 'inventory_date']
  ]);

  console.log(`Trovate ${quants?.length || 0} ubicazioni con giacenza`);
  if (quants && quants.length > 0) {
    console.log("Campi disponibili:", Object.keys(quants[0]));
    quants.forEach(q => {
      console.log(`  - ${q.location_id[1]}: ${q.quantity} (riservati: ${q.reserved_quantity})`);
      if (q.lot_id) console.log(`    Lotto: ${q.lot_id[1]}`);
    });
  }

  // 6. LOTTI - stock.lot
  console.log("\n6. LOTTI PRODOTTO (stock.lot)...");
  const lots = await callKw(sessionId, 'stock.lot', 'search_read', [
    [['product_id', '=', testProduct.id]],
    ['id', 'name', 'product_id', 'product_qty', 'expiration_date', 'use_date', 'removal_date', 'create_date']
  ], { limit: 5 });

  console.log(`Trovati ${lots?.length || 0} lotti`);
  if (lots && lots.length > 0) {
    console.log("Campi disponibili:", Object.keys(lots[0]));
    lots.forEach(l => {
      console.log(`  - ${l.name}: qty ${l.product_qty}, scadenza: ${l.expiration_date || 'N/A'}`);
    });
  }

  // 7. CERCA OMAGGI IN TUTTI I PRODOTTI
  console.log("\n7. ANALISI OMAGGI GLOBALE...");
  const tuttiOmaggi = await callKw(sessionId, 'sale.order.line', 'search_read', [
    [['discount', '=', 100]],
    ['id', 'order_id', 'product_id', 'product_uom_qty', 'price_unit', 'discount', 'state']
  ], { limit: 10, order: 'id desc' });

  console.log(`Trovati ${tuttiOmaggi?.length || 0} omaggi (sconto 100%)`);
  if (tuttiOmaggi && tuttiOmaggi.length > 0) {
    console.log("Esempio struttura omaggio:", JSON.stringify(tuttiOmaggi[0], null, 2));
  }

  // 8. CALCOLO DISCREPANZA
  console.log("\n8. CALCOLO DISCREPANZA GIACENZA...");

  // Totale acquistato
  const allPurchases = await callKw(sessionId, 'purchase.order.line', 'search_read', [
    [['product_id', '=', testProduct.id], ['state', 'in', ['purchase', 'done']]],
    ['qty_received']
  ]);
  const totaleAcquistato = allPurchases?.reduce((sum, l) => sum + (l.qty_received || 0), 0) || 0;

  // Totale venduto
  const allSales = await callKw(sessionId, 'sale.order.line', 'search_read', [
    [['product_id', '=', testProduct.id], ['state', 'in', ['sale', 'done']]],
    ['qty_delivered']
  ]);
  const totaleVenduto = allSales?.reduce((sum, l) => sum + (l.qty_delivered || 0), 0) || 0;

  // Giacenza attuale
  const giacenzaAttuale = testProduct.qty_available;

  // Giacenza teorica
  const giacenzaTeorica = totaleAcquistato - totaleVenduto;

  console.log(`\nProdotto: ${testProduct.name}`);
  console.log(`  Totale acquistato (ricevuto): ${totaleAcquistato}`);
  console.log(`  Totale venduto (consegnato): ${totaleVenduto}`);
  console.log(`  Giacenza teorica: ${giacenzaTeorica}`);
  console.log(`  Giacenza reale: ${giacenzaAttuale}`);
  console.log(`  DISCREPANZA: ${giacenzaAttuale - giacenzaTeorica}`);

  // 9. VERIFICA CAMPI AGGIUNTIVI NEI MODELLI
  console.log("\n9. VERIFICA CAMPI MODELLI ODOO...");

  // Campi sale.order.line
  const saleLineFields = await callKw(sessionId, 'sale.order.line', 'fields_get', [], { attributes: ['string', 'type'] });
  const importantSaleFields = ['discount', 'is_reward_line', 'is_gift', 'is_sample', 'reward_id', 'coupon_id'];
  console.log("\nCampi interessanti in sale.order.line:");
  importantSaleFields.forEach(f => {
    if (saleLineFields && saleLineFields[f]) {
      console.log(`  - ${f}: ${saleLineFields[f].string} (${saleLineFields[f].type})`);
    }
  });

  // 10. RESI / RETTIFICHE
  console.log("\n10. VERIFICA RESI E RETTIFICHE...");
  const resiMoves = await callKw(sessionId, 'stock.move', 'search_read', [
    [['product_id', '=', testProduct.id], ['state', '=', 'done'], ['origin', 'ilike', 'return']],
    ['id', 'name', 'product_uom_qty', 'origin', 'date']
  ], { limit: 5 });
  console.log(`Trovati ${resiMoves?.length || 0} movimenti di reso`);

  return testProduct;
}

async function main() {
  try {
    const { sessionId, uid } = await authenticate();
    if (!sessionId || !uid) {
      console.error("Autenticazione fallita!");
      return;
    }

    await investigateProductData(sessionId);

    console.log("\n=== INVESTIGAZIONE COMPLETATA ===");
  } catch (error) {
    console.error("Errore:", error);
  }
}

main();
