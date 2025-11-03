/**
 * ANALISI MARGINI PRODOTTI - OTTOBRE 2025
 *
 * Questo script si connette a Odoo e recupera:
 * 1. Tutti gli ordini di vendita confermati in Ottobre 2025
 * 2. Tutte le righe prodotto vendute
 * 3. Calcola il margine per ogni prodotto (prezzo vendita - costo)
 * 4. Genera un report dettagliato
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Periodo: Ottobre 2025
const START_DATE = '2025-10-01';
const END_DATE = '2025-10-31';

let sessionCookies = '';

/**
 * Autenticazione su Odoo
 */
async function authenticate() {
  console.log('🔐 Autenticazione su Odoo...');
  console.log(`   URL: ${ODOO_URL}`);
  console.log(`   DB: ${ODOO_DB}`);
  console.log(`   User: ${ODOO_USERNAME}`);

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      }
    })
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    sessionCookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore autenticazione: ${JSON.stringify(data.error)}`);
  }

  if (!data.result || !data.result.uid) {
    throw new Error('Autenticazione fallita - nessun UID ricevuto');
  }

  console.log('✅ Autenticazione riuscita!');
  console.log(`   User ID: ${data.result.uid}`);
  console.log(`   Username: ${data.result.username}`);

  return data.result;
}

/**
 * Chiamata generica a Odoo
 */
async function callOdoo(model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore chiamata Odoo: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

/**
 * Recupera ordini di vendita confermati in Ottobre 2025
 */
async function getSalesOrders() {
  console.log('\n📦 Recupero ordini di vendita Ottobre 2025...');

  const orders = await callOdoo('sale.order', 'search_read', [
    [
      ['state', 'in', ['sale', 'done']], // Solo ordini confermati
      ['date_order', '>=', START_DATE],
      ['date_order', '<=', END_DATE + ' 23:59:59']
    ]
  ], {
    fields: ['name', 'date_order', 'partner_id', 'amount_total', 'order_line', 'state']
  });

  console.log(`✅ Trovati ${orders.length} ordini di vendita`);

  return orders;
}

/**
 * Recupera dettagli righe ordine con margini
 */
async function getOrderLines(orderLineIds) {
  console.log('\n📋 Recupero righe ordine con dettagli prodotto...');

  const lines = await callOdoo('sale.order.line', 'search_read', [
    [['id', 'in', orderLineIds]]
  ], {
    fields: [
      'product_id',
      'name',
      'product_uom_qty',
      'price_unit',
      'price_subtotal',
      'purchase_price', // Costo di acquisto
      'margin',         // Margine calcolato
      'order_id'
    ]
  });

  console.log(`✅ Trovate ${lines.length} righe ordine`);

  return lines;
}

/**
 * Recupera informazioni prodotti
 */
async function getProducts(productIds) {
  console.log('\n🏷️  Recupero dettagli prodotti...');

  const products = await callOdoo('product.product', 'search_read', [
    [['id', 'in', productIds]]
  ], {
    fields: ['id', 'name', 'default_code', 'standard_price', 'list_price', 'categ_id']
  });

  console.log(`✅ Trovati ${products.length} prodotti`);

  // Crea mappa prodotto per lookup veloce
  const productMap = {};
  products.forEach(p => {
    productMap[p.id] = p;
  });

  return productMap;
}

/**
 * Analizza margini e genera report
 */
function analyzeMargins(orders, orderLines, productMap) {
  console.log('\n📊 Analisi margini...\n');

  // Aggrega dati per prodotto
  const productStats = {};

  orderLines.forEach(line => {
    const productId = line.product_id[0];
    const productName = line.product_id[1];
    const product = productMap[productId];

    if (!productStats[productId]) {
      productStats[productId] = {
        id: productId,
        name: productName,
        default_code: product?.default_code || 'N/A',
        category: product?.categ_id?.[1] || 'N/A',
        quantitySold: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalMargin: 0,
        avgSalePrice: 0,
        avgCostPrice: 0
      };
    }

    const stats = productStats[productId];
    stats.quantitySold += line.product_uom_qty;
    stats.totalRevenue += line.price_subtotal;

    // Calcola costo totale
    const purchasePrice = line.purchase_price || product?.standard_price || 0;
    const lineCost = purchasePrice * line.product_uom_qty;
    stats.totalCost += lineCost;

    // Margine
    stats.totalMargin += (line.price_subtotal - lineCost);
  });

  // Calcola medie e ordina per margine totale
  const results = Object.values(productStats).map(stats => {
    stats.avgSalePrice = stats.totalRevenue / stats.quantitySold;
    stats.avgCostPrice = stats.totalCost / stats.quantitySold;
    stats.marginPercentage = stats.totalRevenue > 0
      ? ((stats.totalMargin / stats.totalRevenue) * 100).toFixed(2)
      : 0;

    return stats;
  }).sort((a, b) => b.totalMargin - a.totalMargin);

  // Statistiche globali
  const totalRevenue = results.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalCost = results.reduce((sum, p) => sum + p.totalCost, 0);
  const totalMargin = results.reduce((sum, p) => sum + p.totalMargin, 0);
  const globalMarginPercentage = ((totalMargin / totalRevenue) * 100).toFixed(2);

  // Stampa report
  console.log('='.repeat(120));
  console.log('REPORT MARGINI PRODOTTI - OTTOBRE 2025');
  console.log('='.repeat(120));
  console.log(`Periodo: ${START_DATE} - ${END_DATE}`);
  console.log(`Ordini analizzati: ${orders.length}`);
  console.log(`Prodotti venduti: ${results.length}`);
  console.log('='.repeat(120));
  console.log('\n📈 RIEPILOGO GLOBALE:');
  console.log(`   Fatturato Totale: €${totalRevenue.toFixed(2)}`);
  console.log(`   Costo Totale:     €${totalCost.toFixed(2)}`);
  console.log(`   Margine Totale:   €${totalMargin.toFixed(2)} (${globalMarginPercentage}%)`);
  console.log('\n' + '='.repeat(120));
  console.log('TOP 20 PRODOTTI PER MARGINE:');
  console.log('='.repeat(120));
  console.log(
    'Codice'.padEnd(15) +
    'Nome'.padEnd(40) +
    'Qtà'.padStart(8) +
    'Fatturato'.padStart(12) +
    'Costo'.padStart(12) +
    'Margine €'.padStart(12) +
    'Margine %'.padStart(12)
  );
  console.log('-'.repeat(120));

  results.slice(0, 20).forEach(p => {
    console.log(
      (p.default_code || '').substring(0, 14).padEnd(15) +
      p.name.substring(0, 39).padEnd(40) +
      p.quantitySold.toFixed(0).padStart(8) +
      `€${p.totalRevenue.toFixed(2)}`.padStart(12) +
      `€${p.totalCost.toFixed(2)}`.padStart(12) +
      `€${p.totalMargin.toFixed(2)}`.padStart(12) +
      `${p.marginPercentage}%`.padStart(12)
    );
  });

  console.log('='.repeat(120));
  console.log('\n📉 PRODOTTI CON MARGINE NEGATIVO (Venduti in perdita):');
  console.log('='.repeat(120));

  const negativeMarginsProducts = results.filter(p => p.totalMargin < 0);

  if (negativeMarginsProducts.length > 0) {
    console.log(
      'Codice'.padEnd(15) +
      'Nome'.padEnd(40) +
      'Qtà'.padStart(8) +
      'Fatturato'.padStart(12) +
      'Costo'.padStart(12) +
      'Margine €'.padStart(12) +
      'Margine %'.padStart(12)
    );
    console.log('-'.repeat(120));

    negativeMarginsProducts.forEach(p => {
      console.log(
        (p.default_code || '').substring(0, 14).padEnd(15) +
        p.name.substring(0, 39).padEnd(40) +
        p.quantitySold.toFixed(0).padStart(8) +
        `€${p.totalRevenue.toFixed(2)}`.padStart(12) +
        `€${p.totalCost.toFixed(2)}`.padStart(12) +
        `€${p.totalMargin.toFixed(2)}`.padStart(12) +
        `${p.marginPercentage}%`.padStart(12)
      );
    });
  } else {
    console.log('✅ Nessun prodotto venduto in perdita!');
  }

  console.log('='.repeat(120));

  return {
    products: results,
    summary: {
      totalRevenue,
      totalCost,
      totalMargin,
      globalMarginPercentage,
      orderCount: orders.length,
      productCount: results.length,
      negativeMarginsCount: negativeMarginsProducts.length
    }
  };
}

/**
 * Main
 */
async function main() {
  try {
    console.log('\n🚀 INIZIO ANALISI MARGINI OTTOBRE 2025\n');

    // 1. Autenticazione
    await authenticate();

    // 2. Recupera ordini
    const orders = await getSalesOrders();

    if (orders.length === 0) {
      console.log('\n⚠️  Nessun ordine trovato per Ottobre 2025');
      return;
    }

    // 3. Estrai tutti gli ID delle righe ordine
    const orderLineIds = orders.flatMap(order => order.order_line || []);
    console.log(`\n📌 Totale righe ordine da analizzare: ${orderLineIds.length}`);

    // 4. Recupera dettagli righe
    const orderLines = await getOrderLines(orderLineIds);

    // 5. Estrai ID prodotti unici
    const productIds = [...new Set(orderLines.map(line => line.product_id[0]))];

    // 6. Recupera dettagli prodotti
    const productMap = await getProducts(productIds);

    // 7. Analizza margini
    const analysis = analyzeMargins(orders, orderLines, productMap);

    console.log('\n✅ ANALISI COMPLETATA!\n');

    // Salva risultato dettagliato in JSON
    const fs = require('fs');
    const outputFile = 'margini-ottobre-2025.json';
    fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2), 'utf-8');
    console.log(`💾 Report dettagliato salvato in: ${outputFile}\n`);

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Esegui
main();
