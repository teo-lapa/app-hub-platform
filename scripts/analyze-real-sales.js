/**
 * ANALISI VENDITE REALI DA ODOO STAGING
 * Estrae dati VERI degli ultimi 3 mesi per Smart Ordering
 */

const fs = require('fs');
const path = require('path');

// Configurazione
const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24586501';
const LOGIN = 'paul@lapa.ch';
const PASSWORD = 'lapa201180';

let sessionCookie = null;

// Autenticazione
async function authenticate() {
  console.log('🔐 Autenticazione con Odoo STAGING...');

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      db: ODOO_DB,
      login: LOGIN,
      password: PASSWORD,
    },
    id: Date.now(),
  };

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const sessionMatch = cookies.match(/session_id=([^;]+)/);
    if (sessionMatch) {
      sessionCookie = `session_id=${sessionMatch[1]}`;
    }
  }

  const data = await response.json();
  if (data.error || !data.result?.uid) {
    throw new Error('Autenticazione fallita');
  }

  console.log(`✅ Autenticato come: ${data.result.name}`);
  return data.result;
}

// Chiamata RPC a Odoo
async function odooRPC(model, method, args = [], kwargs = {}) {
  const url = `${ODOO_URL}/web/dataset/call_kw/${model}/${method}`;

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: { model, method, args, kwargs },
    id: Date.now(),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message);
  }

  return data.result;
}

// STEP 1: Analizza vendite ultimi 3 mesi
async function analyzeRecentSales() {
  console.log('\n📊 STEP 1: Analisi vendite ultimi 3 mesi...');

  // Data 3 mesi fa
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const dateFrom = threeMonthsAgo.toISOString().split('T')[0];

  console.log(`📅 Periodo analisi: dal ${dateFrom} ad oggi`);

  // Cerca ordini confermati degli ultimi 3 mesi
  const orders = await odooRPC('sale.order', 'search_read', [], {
    domain: [
      ['state', 'in', ['sale', 'done']],
      ['date_order', '>=', dateFrom]
    ],
    fields: ['name', 'date_order', 'partner_id', 'amount_total'],
    limit: 5000
  });

  console.log(`✅ Trovati ${orders.length} ordini`);

  // Prendi tutte le righe ordine
  const orderIds = orders.map(o => o.id);
  const orderLines = await odooRPC('sale.order.line', 'search_read', [], {
    domain: [['order_id', 'in', orderIds]],
    fields: ['product_id', 'product_uom_qty', 'price_subtotal', 'order_id'],
    limit: 50000
  });

  console.log(`✅ Trovate ${orderLines.length} righe ordine`);

  return { orders, orderLines };
}

// STEP 2: Calcola statistiche per prodotto
async function calculateProductStats(orderLines) {
  console.log('\n📈 STEP 2: Calcolo statistiche per prodotto...');

  const productStats = {};

  orderLines.forEach(line => {
    const productId = line.product_id[0];
    const productName = line.product_id[1];
    const qty = line.product_uom_qty;

    if (!productStats[productId]) {
      productStats[productId] = {
        id: productId,
        name: productName,
        totalSold: 0,
        totalRevenue: 0,
        orderCount: 0,
        orderLines: []
      };
    }

    productStats[productId].totalSold += qty;
    productStats[productId].totalRevenue += line.price_subtotal;
    productStats[productId].orderCount += 1;
    productStats[productId].orderLines.push({
      qty,
      revenue: line.price_subtotal
    });
  });

  // Converti in array e ordina per vendite
  const productsArray = Object.values(productStats);
  productsArray.sort((a, b) => b.totalSold - a.totalSold);

  console.log(`✅ Analizzati ${productsArray.length} prodotti unici`);
  console.log(`\nTop 10 prodotti più venduti:`);
  productsArray.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i+1}. ${p.name}: ${p.totalSold.toFixed(2)} unità`);
  });

  return productsArray;
}

// STEP 3: Carica stock attuale e fornitori
async function loadProductDetails(productIds) {
  console.log('\n📦 STEP 3: Carico stock e fornitori...');

  const products = await odooRPC('product.product', 'search_read', [], {
    domain: [['id', 'in', productIds]],
    fields: [
      'name',
      'qty_available',
      'seller_ids',
      'categ_id',
      'uom_id',
      'list_price'
    ],
    limit: 10000
  });

  console.log(`✅ Caricati dettagli per ${products.length} prodotti`);

  // Carica info fornitori
  const sellerIds = products
    .flatMap(p => p.seller_ids || [])
    .filter(id => id);

  let sellers = [];
  if (sellerIds.length > 0) {
    sellers = await odooRPC('product.supplierinfo', 'search_read', [], {
      domain: [['id', 'in', sellerIds]],
      fields: ['partner_id', 'delay', 'min_qty', 'price'],
      limit: 10000
    });

    console.log(`✅ Caricati ${sellers.length} fornitori`);
  }

  return { products, sellers };
}

// STEP 4: Analisi completa e salvataggio
async function runFullAnalysis() {
  try {
    await authenticate();

    // Analizza vendite
    const { orders, orderLines } = await analyzeRecentSales();

    // Calcola statistiche
    const productStats = await calculateProductStats(orderLines);

    // Filtra solo prodotti con vendite significative (almeno 10 pezzi in 3 mesi)
    const activeProducts = productStats.filter(p => p.totalSold >= 10);
    console.log(`\n🎯 Prodotti attivi (venduti almeno 10 pz): ${activeProducts.length}`);

    // Carica dettagli
    const productIds = activeProducts.map(p => p.id);
    const { products, sellers } = await loadProductDetails(productIds);

    // Mappa fornitori per prodotto
    const sellerMap = {};
    sellers.forEach(s => {
      sellerMap[s.id] = s;
    });

    // Combina dati
    const finalData = activeProducts.map(stat => {
      const product = products.find(p => p.id === stat.id);
      if (!product) return null;

      const avgDailySales = stat.totalSold / 90; // 3 mesi = ~90 giorni
      const daysRemaining = product.qty_available / avgDailySales;

      // Trova fornitore principale
      let supplier = null;
      let leadTime = 7; // default

      if (product.seller_ids && product.seller_ids.length > 0) {
        const sellerId = product.seller_ids[0];
        const sellerInfo = sellerMap[sellerId];
        if (sellerInfo) {
          supplier = {
            id: sellerInfo.partner_id[0],
            name: sellerInfo.partner_id[1],
            leadTime: sellerInfo.delay || 7,
            minQty: sellerInfo.min_qty || 1,
            price: sellerInfo.price || 0
          };
          leadTime = supplier.leadTime;
        }
      }

      return {
        id: stat.id,
        name: stat.name,
        category: product.categ_id ? product.categ_id[1] : 'N/A',
        uom: product.uom_id ? product.uom_id[1] : 'Units',

        // Stock
        currentStock: product.qty_available,

        // Vendite
        totalSold3Months: stat.totalSold,
        avgDailySales: avgDailySales,
        avgMonthlySales: stat.totalSold / 3,
        orderCount: stat.orderCount,

        // Forecast
        daysRemaining: daysRemaining,
        urgencyLevel: daysRemaining <= 3 ? 'CRITICAL' :
                      daysRemaining <= 7 ? 'HIGH' :
                      daysRemaining <= 14 ? 'MEDIUM' : 'LOW',

        // Fornitore
        supplier: supplier,
        leadTime: leadTime,

        // Finanziari
        totalRevenue: stat.totalRevenue,
        avgPrice: stat.totalRevenue / stat.totalSold,
        listPrice: product.list_price
      };
    }).filter(p => p !== null);

    // Salva risultati
    const outputPath = path.join(__dirname, '..', 'lib', 'smart-ordering', 'real-analysis-data.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      analyzedAt: new Date().toISOString(),
      periodFrom: new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0],
      periodTo: new Date().toISOString().split('T')[0],
      totalOrders: orders.length,
      totalOrderLines: orderLines.length,
      totalProducts: finalData.length,
      products: finalData
    }, null, 2));

    console.log(`\n✅ Analisi salvata in: ${outputPath}`);
    console.log(`\n📊 RIEPILOGO:`);
    console.log(`   - Ordini analizzati: ${orders.length}`);
    console.log(`   - Righe ordine: ${orderLines.length}`);
    console.log(`   - Prodotti attivi: ${finalData.length}`);

    const critical = finalData.filter(p => p.urgencyLevel === 'CRITICAL');
    const high = finalData.filter(p => p.urgencyLevel === 'HIGH');
    console.log(`\n🚨 Urgenze:`);
    console.log(`   - CRITICI (≤3 giorni): ${critical.length}`);
    console.log(`   - ALTI (≤7 giorni): ${high.length}`);

    // Raggruppa per fornitore
    const bySupplier = {};
    finalData.forEach(p => {
      if (!p.supplier) return;
      const supplierId = p.supplier.id;
      if (!bySupplier[supplierId]) {
        bySupplier[supplierId] = {
          id: supplierId,
          name: p.supplier.name,
          leadTime: p.supplier.leadTime,
          products: []
        };
      }
      bySupplier[supplierId].products.push(p);
    });

    console.log(`\n📦 Fornitori con prodotti critici/alti:`);
    Object.values(bySupplier)
      .filter(s => s.products.some(p => ['CRITICAL', 'HIGH'].includes(p.urgencyLevel)))
      .sort((a, b) => {
        const aCrit = a.products.filter(p => p.urgencyLevel === 'CRITICAL').length;
        const bCrit = b.products.filter(p => p.urgencyLevel === 'CRITICAL').length;
        return bCrit - aCrit;
      })
      .forEach(supplier => {
        const crit = supplier.products.filter(p => p.urgencyLevel === 'CRITICAL').length;
        const high = supplier.products.filter(p => p.urgencyLevel === 'HIGH').length;
        console.log(`   ${supplier.name}: ${crit} critici, ${high} alti (lead time: ${supplier.leadTime}gg)`);
      });

  } catch (error) {
    console.error('❌ Errore:', error.message);
    throw error;
  }
}

// ESEGUI
runFullAnalysis();
