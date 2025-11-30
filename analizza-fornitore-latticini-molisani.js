/**
 * Analisi Fornitore: LATTICINI MOLISANI TAMBURRO SRL
 *
 * Recupera da Odoo:
 * - Stock attuale
 * - Vendite ultimi 3 mesi
 * - Media giornaliera
 * - Giorni rimanenti
 * - Suggerimenti AI
 * - Cosa ordinare domani
 */

const https = require('https');

// Configurazione Odoo
const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapa-v2-staging-2406-24586501';
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

// Fornitore da analizzare
const SUPPLIER_NAME = 'LATTICINI MOLISANI TAMBURRO SRL';

// Disable SSL verification
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Session ID
let sessionId = null;

// Login Odoo
async function loginOdoo() {
  console.log('🔐 Login Odoo...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      },
      id: 1
    }),
    agent
  });

  const data = await response.json();

  if (data.error) {
    throw new Error('Login fallito: ' + JSON.stringify(data.error));
  }

  // Estrai session_id dai cookies
  const cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('Nessun cookie ricevuto');
  }

  const sessionMatch = cookies.match(/session_id=([^;]+)/);
  if (!sessionMatch) {
    throw new Error('session_id non trovato nei cookie');
  }

  sessionId = sessionMatch[1];
  console.log('✅ Login OK');
  return sessionId;
}

// RPC Call
async function rpc(model, method, args, kwargs = {}) {
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
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000)
    }),
    agent
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Errore RPC');
  }

  return data.result;
}

// Search & Read
async function searchRead(model, domain, fields, limit = 0) {
  return await rpc(model, 'search_read', [domain, fields, 0, limit]);
}

// Main Analysis
async function analyzeSupplier() {
  try {
    // 1. Login
    await loginOdoo();

    console.log(`\n📦 Analisi Fornitore: ${SUPPLIER_NAME}\n`);
    console.log('='.repeat(80));

    // 2. Trova fornitore
    console.log('\n🔍 Ricerca fornitore...');
    const suppliers = await searchRead(
      'res.partner',
      [
        ['name', 'ilike', SUPPLIER_NAME],
        ['supplier_rank', '>', 0]
      ],
      ['id', 'name']
    );

    if (suppliers.length === 0) {
      console.log('❌ Fornitore non trovato');
      return;
    }

    const supplier = suppliers[0];
    console.log(`✅ Trovato: ${supplier.name} (ID: ${supplier.id})`);

    // 3. Trova prodotti del fornitore (ultimi 3 mesi di acquisti)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    console.log('\n📋 Ricerca prodotti ordinati da questo fornitore...');
    const purchaseLines = await searchRead(
      'purchase.order.line',
      [
        ['partner_id', '=', supplier.id],
        ['order_id.date_order', '>=', threeMonthsAgoStr],
        ['order_id.state', 'in', ['purchase', 'done']]
      ],
      ['product_id', 'product_qty', 'date_order'],
      0
    );

    console.log(`✅ Trovate ${purchaseLines.length} righe d'ordine negli ultimi 3 mesi`);

    // Raggruppa per product_id
    const productIds = [...new Set(purchaseLines.map(line => line.product_id[0]))];
    console.log(`📦 ${productIds.length} prodotti unici`);

    if (productIds.length === 0) {
      console.log('⚠️  Nessun prodotto trovato per questo fornitore negli ultimi 3 mesi');
      return;
    }

    // 4. Carica info prodotti
    console.log('\n📊 Caricamento dati prodotti...');
    const products = await searchRead(
      'product.product',
      [
        ['id', 'in', productIds],
        ['type', '=', 'product'],
        ['active', '=', true]
      ],
      ['id', 'name', 'default_code', 'qty_available', 'uom_id', 'list_price'],
      0
    );

    console.log(`✅ ${products.length} prodotti caricati`);

    // 5. Carica vendite ultimi 3 mesi per questi prodotti
    console.log('\n💰 Analisi vendite ultimi 3 mesi...');
    const sales = await searchRead(
      'sale.order.line',
      [
        ['product_id', 'in', productIds],
        ['order_id.effective_date', '>=', threeMonthsAgoStr],
        ['order_id.state', 'in', ['sale', 'done']]
      ],
      ['product_id', 'product_uom_qty', 'price_subtotal'],
      0
    );

    console.log(`✅ ${sales.length} righe di vendita`);

    // 6. Carica merce in arrivo
    console.log('\n🚚 Verifica merce in arrivo...');
    const incomingMoves = await searchRead(
      'stock.move',
      [
        ['product_id', 'in', productIds],
        ['picking_code', '=', 'incoming'],
        ['state', 'in', ['confirmed', 'assigned', 'waiting']]
      ],
      ['product_id', 'product_uom_qty', 'date'],
      0
    );

    console.log(`✅ ${incomingMoves.length} movimenti in arrivo`);

    // Mappa incoming per prodotto
    const incomingMap = new Map();
    incomingMoves.forEach(move => {
      const pid = move.product_id[0];
      const existing = incomingMap.get(pid) || { qty: 0, date: null };
      existing.qty += move.product_uom_qty || 0;

      if (move.date) {
        const moveDate = new Date(move.date);
        if (!existing.date || moveDate < existing.date) {
          existing.date = moveDate;
        }
      }

      incomingMap.set(pid, existing);
    });

    // 7. Aggrega vendite per prodotto
    const salesMap = new Map();
    sales.forEach(line => {
      const pid = line.product_id[0];
      if (!salesMap.has(pid)) {
        salesMap.set(pid, {
          totalQty: 0,
          totalRevenue: 0,
          count: 0
        });
      }
      const stats = salesMap.get(pid);
      stats.totalQty += line.product_uom_qty || 0;
      stats.totalRevenue += line.price_subtotal || 0;
      stats.count++;
    });

    // 8. Analizza ogni prodotto
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALISI DETTAGLIATA PRODOTTI');
    console.log('='.repeat(80));

    const analysisResults = [];
    const DAYS_IN_PERIOD = 90;
    const LEAD_TIME = 3; // Lead time fornitore

    products.forEach(product => {
      const sales = salesMap.get(product.id);

      // Solo prodotti con vendite
      if (!sales || sales.totalQty === 0) return;

      const avgDailySales = sales.totalQty / DAYS_IN_PERIOD;
      const currentStock = product.qty_available || 0;

      // Merce in arrivo
      const incoming = incomingMap.get(product.id);
      const incomingQty = incoming?.qty || 0;
      const incomingDate = incoming?.date;
      const effectiveStock = currentStock + incomingQty;

      // Giorni rimanenti
      const daysRemaining = avgDailySales > 0 ? effectiveStock / avgDailySales : 999;

      // Urgenza
      let urgencyLevel = 'LOW';
      if (daysRemaining <= 2) urgencyLevel = 'CRITICAL';
      else if (daysRemaining <= 5) urgencyLevel = 'HIGH';
      else if (daysRemaining <= 10) urgencyLevel = 'MEDIUM';

      // Calcola quantità suggerita
      // Formula: (LEAD_TIME + buffer) * avgDailySales - effectiveStock
      const BUFFER_DAYS = 7; // Buffer di sicurezza
      const targetStock = (LEAD_TIME + BUFFER_DAYS) * avgDailySales;
      const suggestedQty = Math.max(0, Math.ceil(targetStock - effectiveStock));

      analysisResults.push({
        id: product.id,
        name: product.name,
        code: product.default_code,
        currentStock,
        incomingQty,
        incomingDate,
        effectiveStock,
        avgDailySales,
        daysRemaining,
        urgencyLevel,
        suggestedQty,
        totalSold: sales.totalQty,
        totalRevenue: sales.totalRevenue,
        uom: product.uom_id ? product.uom_id[1] : 'Units',
        price: product.list_price
      });
    });

    // Ordina per urgenza
    analysisResults.sort((a, b) => {
      const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
    });

    // 9. Mostra risultati
    console.log('\n');
    let totalOrderValue = 0;
    let totalOrderQty = 0;

    analysisResults.forEach((product, index) => {
      const urgencyEmoji = {
        CRITICAL: '🔴',
        HIGH: '🟠',
        MEDIUM: '🟡',
        LOW: '🟢'
      }[product.urgencyLevel];

      console.log(`\n${index + 1}. ${urgencyEmoji} ${product.urgencyLevel} - ${product.name}`);
      console.log(`   Codice: ${product.code || 'N/A'}`);
      console.log(`   Stock attuale: ${product.currentStock.toFixed(1)} ${product.uom}`);

      if (product.incomingQty > 0) {
        const dateStr = product.incomingDate ? product.incomingDate.toLocaleDateString('it-IT') : 'N/A';
        console.log(`   🚚 In arrivo: ${product.incomingQty.toFixed(1)} ${product.uom} (${dateStr})`);
        console.log(`   Stock effettivo: ${product.effectiveStock.toFixed(1)} ${product.uom}`);
      }

      console.log(`   Media vendite: ${product.avgDailySales.toFixed(2)} ${product.uom}/giorno`);
      console.log(`   Giorni rimanenti: ${product.daysRemaining.toFixed(1)} giorni`);
      console.log(`   📊 Suggerimento AI: ${product.suggestedQty} ${product.uom}`);

      if (product.suggestedQty > 0) {
        const orderValue = product.suggestedQty * product.price;
        console.log(`   💰 Valore ordine: CHF ${orderValue.toFixed(2)}`);
        totalOrderValue += orderValue;
        totalOrderQty += product.suggestedQty;
      }

      console.log(`   Venduto 3 mesi: ${product.totalSold.toFixed(1)} ${product.uom} (CHF ${product.totalRevenue.toFixed(2)})`);
      console.log('   ' + '-'.repeat(76));
    });

    // 10. Riepilogo ordine
    console.log('\n' + '='.repeat(80));
    console.log('📋 RIEPILOGO ORDINE SUGGERITO');
    console.log('='.repeat(80));
    console.log(`\nFornitore: ${supplier.name}`);
    console.log(`Lead Time: ${LEAD_TIME} giorni`);
    console.log(`\nProdotti da ordinare: ${analysisResults.filter(p => p.suggestedQty > 0).length}/${analysisResults.length}`);
    console.log(`Quantità totale: ${totalOrderQty.toFixed(0)} unità`);
    console.log(`💰 Valore totale stimato: CHF ${totalOrderValue.toFixed(2)}`);

    console.log('\n🔴 PRODOTTI CRITICI (da ordinare SUBITO):');
    const criticalProducts = analysisResults.filter(p => p.urgencyLevel === 'CRITICAL' && p.suggestedQty > 0);

    if (criticalProducts.length === 0) {
      console.log('   Nessun prodotto critico');
    } else {
      criticalProducts.forEach(p => {
        console.log(`   - ${p.name}: ${p.suggestedQty} ${p.uom} (stock: ${p.currentStock.toFixed(1)}, giorni rim: ${p.daysRemaining.toFixed(1)})`);
      });
    }

    console.log('\n🟠 PRODOTTI HIGH (da ordinare presto):');
    const highProducts = analysisResults.filter(p => p.urgencyLevel === 'HIGH' && p.suggestedQty > 0);

    if (highProducts.length === 0) {
      console.log('   Nessun prodotto HIGH');
    } else {
      highProducts.forEach(p => {
        console.log(`   - ${p.name}: ${p.suggestedQty} ${p.uom} (stock: ${p.currentStock.toFixed(1)}, giorni rim: ${p.daysRemaining.toFixed(1)})`);
      });
    }

    // 11. Raccomandazioni
    console.log('\n' + '='.repeat(80));
    console.log('💡 RACCOMANDAZIONI');
    console.log('='.repeat(80));

    if (criticalProducts.length > 0) {
      console.log('\n⚠️  AZIONE IMMEDIATA RICHIESTA:');
      console.log(`   Hai ${criticalProducts.length} prodotti CRITICI con meno di 2 giorni di stock!`);
      console.log('   Considera di ordinare OGGI per evitare rotture di stock.');
    }

    if (totalOrderValue < 2000) {
      console.log('\n📦 VALORE ORDINE MINIMO:');
      console.log(`   L'ordine suggerito (CHF ${totalOrderValue.toFixed(2)}) è sotto il minimo consigliato di CHF 2000.`);
      console.log('   Considera di aggiungere altri prodotti o attendere.');
    }

    const productsWithIncoming = analysisResults.filter(p => p.incomingQty > 0);
    if (productsWithIncoming.length > 0) {
      console.log('\n🚚 MERCE IN ARRIVO:');
      console.log(`   ${productsWithIncoming.length} prodotti hanno merce già ordinata in arrivo.`);
      console.log('   Verifica le date di arrivo prima di riordinare.');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analisi completata!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
analyzeSupplier();
