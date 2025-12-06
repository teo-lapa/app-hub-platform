// Investigazione approfondita SALE FINO SPEISESALZ MIT IOD JURASEL 25KG
// Barcode: 7610039000242

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
  if (data.error) {
    console.error(`Errore ${model}.${method}:`, data.error.data?.message || data.error);
    return null;
  }
  return data.result;
}

async function investigateSaleFino(sessionId) {
  console.log("=== INVESTIGAZIONE SALE FINO SPEISESALZ MIT IOD JURASEL 25KG ===\n");

  // 1. Trova il prodotto
  const products = await callKw(sessionId, 'product.product', 'search_read', [
    [['barcode', '=', '7610039000242']],
    ['id', 'name', 'qty_available', 'virtual_available', 'incoming_qty', 'outgoing_qty']
  ]);

  if (!products || products.length === 0) {
    console.log("Prodotto non trovato!");
    return;
  }

  const product = products[0];
  console.log(`Prodotto: ${product.name} (ID: ${product.id})`);
  console.log(`Giacenza attuale: ${product.qty_available}`);
  console.log(`Virtuale: ${product.virtual_available}`);
  console.log(`In arrivo: ${product.incoming_qty}`);
  console.log(`In uscita: ${product.outgoing_qty}`);

  // 2. TUTTI i movimenti di stock (senza limite)
  console.log("\n=== TUTTI I MOVIMENTI STOCK ===");
  const allMoves = await callKw(sessionId, 'stock.move', 'search_read', [
    [['product_id', '=', product.id], ['state', '=', 'done']],
    ['id', 'name', 'product_uom_qty', 'quantity', 'location_id', 'location_dest_id', 'date', 'origin', 'reference', 'picking_id']
  ], { order: 'date asc' });

  console.log(`Totale movimenti completati: ${allMoves?.length || 0}`);

  // Analizza movimenti per tipo
  let totalIn = 0;
  let totalOut = 0;
  let totalInternal = 0;
  let totalAdjustment = 0;

  const movementsByType = {
    in: [],
    out: [],
    internal: [],
    adjustment: []
  };

  for (const m of (allMoves || [])) {
    const fromLoc = m.location_id[1];
    const toLoc = m.location_dest_id[1];
    const qty = m.quantity;

    if (fromLoc.includes('Vendor') || fromLoc.includes('Supplier')) {
      // Entrata da fornitore
      totalIn += qty;
      movementsByType.in.push({ date: m.date, qty, origin: m.origin || m.reference, from: fromLoc, to: toLoc });
    } else if (toLoc.includes('Customer')) {
      // Uscita a cliente
      totalOut += qty;
      movementsByType.out.push({ date: m.date, qty, origin: m.origin || m.reference, from: fromLoc, to: toLoc });
    } else if (fromLoc.includes('Inventory adjustment') || toLoc.includes('Inventory adjustment')) {
      // Rettifica inventario
      if (toLoc.includes('Inventory adjustment')) {
        totalAdjustment -= qty; // Diminuzione
      } else {
        totalAdjustment += qty; // Aumento
      }
      movementsByType.adjustment.push({ date: m.date, qty, origin: m.origin || m.reference, from: fromLoc, to: toLoc });
    } else if (fromLoc.includes('WH/') && toLoc.includes('WH/')) {
      // Trasferimento interno
      totalInternal += qty;
      movementsByType.internal.push({ date: m.date, qty, origin: m.origin || m.reference, from: fromLoc, to: toLoc });
    } else {
      console.log(`  [?] ${m.date}: ${qty} - ${fromLoc} -> ${toLoc} (${m.origin})`);
    }
  }

  console.log("\n--- RIEPILOGO MOVIMENTI ---");
  console.log(`Entrate da fornitori: +${totalIn}`);
  console.log(`Uscite a clienti: -${totalOut}`);
  console.log(`Rettifiche inventario: ${totalAdjustment >= 0 ? '+' : ''}${totalAdjustment}`);
  console.log(`Trasferimenti interni: ${totalInternal} (non influenzano giacenza)`);

  const theoreticalStock = totalIn - totalOut + totalAdjustment;
  console.log(`\nGiacenza teorica: ${totalIn} - ${totalOut} + ${totalAdjustment} = ${theoreticalStock}`);
  console.log(`Giacenza reale: ${product.qty_available}`);
  console.log(`DISCREPANZA: ${product.qty_available - theoreticalStock}`);

  // 3. Dettaglio rettifiche inventario
  console.log("\n=== DETTAGLIO RETTIFICHE INVENTARIO ===");
  for (const adj of movementsByType.adjustment) {
    const direction = adj.to.includes('Inventory adjustment') ? 'DIMINUZIONE' : 'AUMENTO';
    console.log(`  ${adj.date}: ${direction} ${adj.qty} unità`);
    console.log(`    Da: ${adj.from} -> A: ${adj.to}`);
    console.log(`    Origine: ${adj.origin || 'N/A'}`);
  }

  // 4. Cerca movimenti "strani" (verso Production, Scrap, ecc)
  console.log("\n=== MOVIMENTI VERSO LOCATIONS SPECIALI ===");
  const specialMoves = (allMoves || []).filter(m =>
    m.location_dest_id[1].includes('Scrap') ||
    m.location_dest_id[1].includes('Production') ||
    m.location_dest_id[1].includes('Virtual') ||
    m.location_id[1].includes('Scrap') ||
    m.location_id[1].includes('Production')
  );
  console.log(`Trovati ${specialMoves.length} movimenti speciali`);
  for (const m of specialMoves) {
    console.log(`  ${m.date}: ${m.quantity} - ${m.location_id[1]} -> ${m.location_dest_id[1]}`);
  }

  // 5. Stock quants - dove si trova fisicamente il prodotto
  console.log("\n=== UBICAZIONI ATTUALI (stock.quant) ===");
  const quants = await callKw(sessionId, 'stock.quant', 'search_read', [
    [['product_id', '=', product.id]],
    ['location_id', 'quantity', 'reserved_quantity', 'lot_id']
  ]);

  let totalQuants = 0;
  for (const q of (quants || [])) {
    if (q.quantity !== 0) {
      console.log(`  ${q.location_id[1]}: ${q.quantity} (riservati: ${q.reserved_quantity})`);
      totalQuants += q.quantity;
    }
  }
  console.log(`Totale in stock.quant: ${totalQuants}`);

  // 6. Ordini di acquisto
  console.log("\n=== ORDINI DI ACQUISTO ===");
  const purchaseLines = await callKw(sessionId, 'purchase.order.line', 'search_read', [
    [['product_id', '=', product.id]],
    ['order_id', 'product_qty', 'qty_received', 'state', 'date_planned']
  ], { order: 'id asc' });

  let totalOrdered = 0;
  let totalReceived = 0;
  for (const pl of (purchaseLines || [])) {
    console.log(`  ${pl.order_id[1]}: ordinati ${pl.product_qty}, ricevuti ${pl.qty_received}, stato: ${pl.state}`);
    if (['purchase', 'done'].includes(pl.state)) {
      totalOrdered += pl.product_qty;
      totalReceived += pl.qty_received;
    }
  }
  console.log(`Totale ordinato: ${totalOrdered}, Totale ricevuto: ${totalReceived}`);

  // 7. Ordini di vendita
  console.log("\n=== ORDINI DI VENDITA ===");
  const saleLines = await callKw(sessionId, 'sale.order.line', 'search_read', [
    [['product_id', '=', product.id]],
    ['order_id', 'product_uom_qty', 'qty_delivered', 'state']
  ], { order: 'id asc' });

  let totalSaleOrdered = 0;
  let totalDelivered = 0;
  for (const sl of (saleLines || [])) {
    if (['sale', 'done'].includes(sl.state)) {
      totalSaleOrdered += sl.product_uom_qty;
      totalDelivered += sl.qty_delivered;
    }
  }
  console.log(`Totale venduto: ${totalSaleOrdered}, Totale consegnato: ${totalDelivered}`);

  // 8. Scarti
  console.log("\n=== SCARTI ===");
  const scraps = await callKw(sessionId, 'stock.scrap', 'search_read', [
    [['product_id', '=', product.id]],
    ['name', 'scrap_qty', 'date_done', 'state', 'origin']
  ]);

  let totalScrapped = 0;
  for (const s of (scraps || [])) {
    console.log(`  ${s.date_done}: ${s.scrap_qty} unità - ${s.name} (${s.state})`);
    if (s.state === 'done') {
      totalScrapped += s.scrap_qty;
    }
  }
  console.log(`Totale scartato: ${totalScrapped}`);

  // 9. CONCLUSIONE
  console.log("\n========================================");
  console.log("ANALISI FINALE");
  console.log("========================================");
  console.log(`Ricevuto da fornitori: +${totalReceived}`);
  console.log(`Consegnato a clienti: -${totalDelivered}`);
  console.log(`Scartato: -${totalScrapped}`);
  console.log(`Rettifiche: ${totalAdjustment >= 0 ? '+' : ''}${totalAdjustment}`);
  console.log(`----------------------------------------`);
  const finalTheoretical = totalReceived - totalDelivered - totalScrapped + totalAdjustment;
  console.log(`GIACENZA TEORICA: ${finalTheoretical}`);
  console.log(`GIACENZA REALE: ${product.qty_available}`);
  console.log(`DIFFERENZA NON SPIEGATA: ${product.qty_available - finalTheoretical}`);

  if (Math.abs(product.qty_available - finalTheoretical) > 1) {
    console.log("\n⚠️  ATTENZIONE: C'è una discrepanza significativa!");
    console.log("Possibili cause:");
    console.log("  1. Movimenti non completati (draft/waiting)");
    console.log("  2. Errori nei trasferimenti interni");
    console.log("  3. Prodotto in ubicazioni virtuali");
    console.log("  4. Inventario fisico diverso da quello registrato");
  }
}

async function main() {
  const { sessionId, uid } = await authenticate();
  if (!sessionId || !uid) {
    console.error("Autenticazione fallita!");
    return;
  }
  console.log("Autenticato come UID:", uid, "\n");
  await investigateSaleFino(sessionId);
}

main();
