/**
 * ANALISI COMPLETA FORNITORE - LATTICINI MOLISANI TAMBURRO SRL
 *
 * Calcola esattamente cosa ordinare considerando:
 * - Stock attuale
 * - Merce in arrivo
 * - Lead time (3 giorni)
 * - Consumo giornaliero
 * - Margine di sicurezza (7 giorni)
 *
 * LOGICA:
 * Se ordino DOMANI → arriva tra 3 giorni
 * In questi 3 giorni consumo X
 * Poi voglio avere margine di 7 giorni extra
 * Totale: devo avere stock per 10 giorni (3 lead + 7 buffer)
 */

const https = require('https');
const fs = require('fs');

// Leggi configurazione da .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const ODOO_URL = envContent.match(/ODOO_URL="?([^"\n]+)"?/)?.[1] || '';
const ODOO_DB = envContent.match(/ODOO_DB="?([^"\n]+)"?/)?.[1] || '';

// Parametri analisi
const SUPPLIER_NAME = 'LATTICINI MOLISANI TAMBURRO SRL';
const LEAD_TIME_DAYS = 3; // Tempo di consegna
const SAFETY_BUFFER_DAYS = 7; // Margine di sicurezza
const TOTAL_COVERAGE_DAYS = LEAD_TIME_DAYS + SAFETY_BUFFER_DAYS; // 10 giorni totali

// Disable SSL
const agent = new https.Agent({
  rejectUnauthorized: false
});

let sessionId = null;

// Login usando le credenziali dal .env
async function loginOdoo() {
  console.log('🔐 Login Odoo...');

  // Leggi .env.local per le credenziali
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const username = envContent.match(/ODOO_ADMIN_EMAIL="?([^"\n]+)"?/)?.[1];
  const password = envContent.match(/ODOO_ADMIN_PASSWORD="?([^"\n]+)"?/)?.[1];

  if (!username || !password) {
    throw new Error('Credenziali Odoo non trovate in .env.local');
  }

  console.log(`   Username: ${username}`);

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: username, password: password },
      id: 1
    }),
    agent
  });

  const data = await response.json();
  if (data.error) throw new Error('Login fallito: ' + JSON.stringify(data.error));

  const cookies = response.headers.get('set-cookie');
  const sessionMatch = cookies?.match(/session_id=([^;]+)/);
  if (!sessionMatch) throw new Error('Session ID non trovato');

  sessionId = sessionMatch[1];
  console.log('✅ Login OK\n');
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
      params: { model, method, args, kwargs },
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

// Search & Read wrapper
async function searchRead(model, domain, fields, limit = 0) {
  return await rpc(model, 'search_read', [domain, fields, 0, limit]);
}

// Funzione principale
async function analyzeSupplier() {
  try {
    await loginOdoo();

    console.log('═'.repeat(80));
    console.log('🏭 ANALISI COMPLETA FORNITORE');
    console.log('═'.repeat(80));
    console.log(`Fornitore: ${SUPPLIER_NAME}`);
    console.log(`Lead Time: ${LEAD_TIME_DAYS} giorni`);
    console.log(`Buffer Sicurezza: ${SAFETY_BUFFER_DAYS} giorni`);
    console.log(`Copertura Totale: ${TOTAL_COVERAGE_DAYS} giorni`);
    console.log('═'.repeat(80) + '\n');

    // 1. Trova fornitore
    console.log('🔍 Ricerca fornitore...');
    const suppliers = await searchRead(
      'res.partner',
      [['name', 'ilike', SUPPLIER_NAME], ['supplier_rank', '>', 0]],
      ['id', 'name']
    );

    if (suppliers.length === 0) {
      console.log('❌ Fornitore non trovato');
      return;
    }

    const supplier = suppliers[0];
    console.log(`✅ Trovato: ${supplier.name} (ID: ${supplier.id})\n`);

    // 2. Trova tutti i prodotti del fornitore (ultimi 6 mesi)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    console.log('📋 Caricamento ordini acquisto ultimi 6 mesi...');
    const purchaseLines = await searchRead(
      'purchase.order.line',
      [
        ['partner_id', '=', supplier.id],
        ['order_id.date_order', '>=', sixMonthsAgoStr],
        ['order_id.state', 'in', ['purchase', 'done']]
      ],
      ['product_id', 'product_qty', 'date_order'],
      0
    );

    console.log(`✅ ${purchaseLines.length} righe d'ordine\n`);

    const productIds = [...new Set(purchaseLines.map(line => line.product_id[0]))];
    console.log(`📦 ${productIds.length} prodotti unici trovati\n`);

    if (productIds.length === 0) {
      console.log('⚠️  Nessun prodotto trovato');
      return;
    }

    // 3. Carica dati prodotti
    console.log('📊 Caricamento dati prodotti...');
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
    console.log(`✅ ${products.length} prodotti caricati\n`);

    // 4. Carica vendite ultimi 3 mesi
    console.log('💰 Caricamento vendite ultimi 3 mesi...');
    const sales = await searchRead(
      'sale.order.line',
      [
        ['product_id', 'in', productIds],
        ['order_id.effective_date', '>=', threeMonthsAgoStr],
        ['order_id.state', 'in', ['sale', 'done']]
      ],
      ['product_id', 'product_uom_qty', 'price_subtotal', 'order_id'],
      0
    );
    console.log(`✅ ${sales.length} righe vendite\n`);

    // 5. Carica merce in arrivo
    console.log('🚚 Verifica merce in arrivo...');
    const incomingMoves = await searchRead(
      'stock.move',
      [
        ['product_id', 'in', productIds],
        ['picking_code', '=', 'incoming'],
        ['state', 'in', ['confirmed', 'assigned', 'waiting']]
      ],
      ['product_id', 'product_uom_qty', 'date', 'picking_id'],
      0
    );
    console.log(`✅ ${incomingMoves.length} movimenti in arrivo\n`);

    // Aggrega incoming per prodotto
    const incomingMap = new Map();
    for (const move of incomingMoves) {
      const pid = move.product_id[0];
      const existing = incomingMap.get(pid) || { qty: 0, date: null, pickingName: null };
      existing.qty += move.product_uom_qty || 0;

      if (move.date) {
        const moveDate = new Date(move.date);
        if (!existing.date || moveDate < existing.date) {
          existing.date = moveDate;
        }
      }

      if (move.picking_id && !existing.pickingName) {
        existing.pickingName = move.picking_id[1];
      }

      incomingMap.set(pid, existing);
    }

    // 6. Aggrega vendite per prodotto
    const salesMap = new Map();
    sales.forEach(line => {
      const pid = line.product_id[0];
      if (!salesMap.has(pid)) {
        salesMap.set(pid, { totalQty: 0, totalRevenue: 0, count: 0 });
      }
      const stats = salesMap.get(pid);
      stats.totalQty += line.product_uom_qty || 0;
      stats.totalRevenue += line.price_subtotal || 0;
      stats.count++;
    });

    // 7. CALCOLA ORDINE PER OGNI PRODOTTO
    console.log('═'.repeat(80));
    console.log('🎯 CALCOLO ORDINE INTELLIGENTE');
    console.log('═'.repeat(80) + '\n');

    const today = new Date();
    const deliveryDate = new Date(today);
    deliveryDate.setDate(deliveryDate.getDate() + LEAD_TIME_DAYS);

    console.log(`📅 Se ordini DOMANI (${new Date(today.getTime() + 86400000).toLocaleDateString('it-IT')})`);
    console.log(`   → Arrivo previsto: ${deliveryDate.toLocaleDateString('it-IT')}`);
    console.log(`   → Tempo di attesa: ${LEAD_TIME_DAYS} giorni\n`);

    const DAYS_IN_PERIOD = 90; // 3 mesi
    const analysisResults = [];

    products.forEach(product => {
      const salesStats = salesMap.get(product.id);

      // Solo prodotti con vendite
      if (!salesStats || salesStats.totalQty === 0) return;

      const currentStock = product.qty_available || 0;
      const avgDailySales = salesStats.totalQty / DAYS_IN_PERIOD;

      // Merce in arrivo
      const incoming = incomingMap.get(product.id);
      const incomingQty = incoming?.qty || 0;
      const incomingDate = incoming?.date;
      const incomingName = incoming?.pickingName;

      // Stock effettivo (stock + in arrivo)
      const effectiveStock = currentStock + incomingQty;

      // Giorni copertura con stock attuale
      const currentDaysCoverage = avgDailySales > 0 ? effectiveStock / avgDailySales : 999;

      // CALCOLO QUANTITÀ DA ORDINARE
      // Formula: (consumo_giornaliero × giorni_copertura_totale) - stock_effettivo
      const targetStock = avgDailySales * TOTAL_COVERAGE_DAYS;
      const qtyNeeded = Math.max(0, targetStock - effectiveStock);
      const suggestedQty = Math.ceil(qtyNeeded); // Arrotonda per eccesso

      // Consumo durante lead time
      const consumptionDuringLeadTime = avgDailySales * LEAD_TIME_DAYS;

      // Urgenza
      let urgencyLevel = 'LOW';
      if (currentDaysCoverage <= 2) urgencyLevel = 'CRITICAL';
      else if (currentDaysCoverage <= 5) urgencyLevel = 'HIGH';
      else if (currentDaysCoverage <= 10) urgencyLevel = 'MEDIUM';

      analysisResults.push({
        id: product.id,
        name: product.name,
        code: product.default_code,
        currentStock,
        incomingQty,
        incomingDate,
        incomingName,
        effectiveStock,
        avgDailySales,
        currentDaysCoverage,
        consumptionDuringLeadTime,
        targetStock,
        suggestedQty,
        urgencyLevel,
        totalSold: salesStats.totalQty,
        totalRevenue: salesStats.totalRevenue,
        uom: product.uom_id ? product.uom_id[1] : 'Units',
        price: product.list_price
      });
    });

    // Ordina per urgenza
    analysisResults.sort((a, b) => {
      const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
    });

    // 8. MOSTRA RISULTATI DETTAGLIATI
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
      console.log('─'.repeat(78));

      // Stock attuale
      console.log(`📦 STOCK ATTUALE:`);
      console.log(`   • Stock magazzino: ${product.currentStock.toFixed(2)} ${product.uom}`);

      if (product.incomingQty > 0) {
        const dateStr = product.incomingDate
          ? new Date(product.incomingDate).toLocaleDateString('it-IT')
          : 'Data non specificata';
        console.log(`   • 🚚 In arrivo: ${product.incomingQty.toFixed(2)} ${product.uom}`);
        console.log(`      Arrivo previsto: ${dateStr}`);
        if (product.incomingName) {
          console.log(`      Ordine: ${product.incomingName}`);
        }
      }

      console.log(`   • 📊 STOCK EFFETTIVO: ${product.effectiveStock.toFixed(2)} ${product.uom}`);

      // Consumi
      console.log(`\n💹 ANALISI CONSUMI:`);
      console.log(`   • Media vendite: ${product.avgDailySales.toFixed(2)} ${product.uom}/giorno`);
      console.log(`   • Copertura attuale: ${product.currentDaysCoverage.toFixed(1)} giorni`);
      console.log(`   • Consumo durante lead time (${LEAD_TIME_DAYS}gg): ${product.consumptionDuringLeadTime.toFixed(2)} ${product.uom}`);

      // Calcolo ordine
      console.log(`\n🎯 CALCOLO ORDINE:`);
      console.log(`   • Target copertura: ${TOTAL_COVERAGE_DAYS} giorni (${LEAD_TIME_DAYS} lead + ${SAFETY_BUFFER_DAYS} buffer)`);
      console.log(`   • Stock target: ${product.targetStock.toFixed(2)} ${product.uom}`);
      console.log(`   • Stock effettivo: ${product.effectiveStock.toFixed(2)} ${product.uom}`);
      console.log(`   • 📊 QUANTITÀ DA ORDINARE: ${product.suggestedQty} ${product.uom}`);

      if (product.suggestedQty > 0) {
        const orderValue = product.suggestedQty * product.price;
        console.log(`   • 💰 Valore: CHF ${orderValue.toFixed(2)} (@CHF ${product.price.toFixed(2)}/${product.uom})`);
        totalOrderValue += orderValue;
        totalOrderQty += product.suggestedQty;
      } else {
        console.log(`   • ✅ Stock sufficiente - non ordinare ora`);
      }

      console.log(`\n📈 STORICO:`);
      console.log(`   • Venduto 3 mesi: ${product.totalSold.toFixed(1)} ${product.uom}`);
      console.log(`   • Revenue 3 mesi: CHF ${product.totalRevenue.toFixed(2)}`);
    });

    // 9. RIEPILOGO FINALE
    console.log('\n\n' + '═'.repeat(80));
    console.log('📋 ORDINE FINALE - COSA ORDINARE DOMANI');
    console.log('═'.repeat(80));

    console.log(`\n🏭 Fornitore: ${supplier.name}`);
    console.log(`📅 Data ordine: DOMANI (${new Date(today.getTime() + 86400000).toLocaleDateString('it-IT')})`);
    console.log(`🚚 Arrivo previsto: ${deliveryDate.toLocaleDateString('it-IT')} (${LEAD_TIME_DAYS} giorni)`);

    // Prodotti per urgenza
    const critical = analysisResults.filter(p => p.urgencyLevel === 'CRITICAL');
    const high = analysisResults.filter(p => p.urgencyLevel === 'HIGH');
    const medium = analysisResults.filter(p => p.urgencyLevel === 'MEDIUM');
    const low = analysisResults.filter(p => p.urgencyLevel === 'LOW');

    console.log(`\n📊 TOTALE PRODOTTI:`);
    console.log(`   • ${critical.length} CRITICI (< 2 giorni)`);
    console.log(`   • ${high.length} HIGH (< 5 giorni)`);
    console.log(`   • ${medium.length} MEDIUM (< 10 giorni)`);
    console.log(`   • ${low.length} LOW (> 10 giorni)`);

    // Prodotti da ordinare
    const toOrder = analysisResults.filter(p => p.suggestedQty > 0);
    console.log(`\n🛒 PRODOTTI DA ORDINARE: ${toOrder.length}/${analysisResults.length}`);

    if (critical.length > 0) {
      console.log(`\n🔴 PRIORITÀ 1 - CRITICI (ordina SUBITO):`);
      critical.forEach(p => {
        if (p.suggestedQty > 0) {
          console.log(`   ✓ ${p.name}`);
          console.log(`     → Ordina: ${p.suggestedQty} ${p.uom}`);
          console.log(`     → Motivo: Solo ${p.currentDaysCoverage.toFixed(1)} giorni di stock`);
          if (p.incomingQty > 0) {
            console.log(`     → Nota: ${p.incomingQty.toFixed(1)} ${p.uom} già in arrivo`);
          }
        }
      });
    }

    if (high.length > 0) {
      console.log(`\n🟠 PRIORITÀ 2 - HIGH (ordina presto):`);
      high.forEach(p => {
        if (p.suggestedQty > 0) {
          console.log(`   ✓ ${p.name}`);
          console.log(`     → Ordina: ${p.suggestedQty} ${p.uom}`);
          console.log(`     → Copertura: ${p.currentDaysCoverage.toFixed(1)} giorni`);
        }
      });
    }

    if (medium.length > 0) {
      console.log(`\n🟡 PRIORITÀ 3 - MEDIUM (monitora):`);
      medium.forEach(p => {
        if (p.suggestedQty > 0) {
          console.log(`   • ${p.name}: ${p.suggestedQty} ${p.uom} (copertura: ${p.currentDaysCoverage.toFixed(1)}gg)`);
        }
      });
    }

    console.log(`\n💰 VALORE ORDINE:`);
    console.log(`   • Totale pezzi: ${totalOrderQty.toFixed(0)} unità`);
    console.log(`   • Valore totale: CHF ${totalOrderValue.toFixed(2)}`);

    if (totalOrderValue < 2000) {
      console.log(`   ⚠️  Sotto soglia CHF 2000 - considera di aggiungere prodotti MEDIUM`);
    } else {
      console.log(`   ✅ Ordine sopra soglia minima`);
    }

    // Salva report
    const reportData = {
      supplier: supplier.name,
      supplierId: supplier.id,
      analysisDate: new Date().toISOString(),
      leadTimeDays: LEAD_TIME_DAYS,
      safetyBufferDays: SAFETY_BUFFER_DAYS,
      totalCoverageDays: TOTAL_COVERAGE_DAYS,
      orderDate: new Date(today.getTime() + 86400000).toISOString(),
      deliveryDate: deliveryDate.toISOString(),
      summary: {
        totalProducts: analysisResults.length,
        productsToOrder: toOrder.length,
        criticalCount: critical.length,
        highCount: high.length,
        mediumCount: medium.length,
        lowCount: low.length,
        totalOrderValue,
        totalOrderQty
      },
      products: analysisResults
    };

    const reportFile = 'report-latticini-molisani.json';
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));

    console.log(`\n📄 Report salvato in: ${reportFile}`);

    console.log('\n' + '═'.repeat(80));
    console.log('✅ ANALISI COMPLETATA');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Esegui
analyzeSupplier();
