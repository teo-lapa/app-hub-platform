const xmlrpc = require('xmlrpc');

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Nome prodotto da analizzare
const PRODUCT_NAME = 'FIORDILATTE JULIENNE TAGLIO NAPOLI';

// Data 6 mesi fa
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
const dateFrom = sixMonthsAgo.toISOString().split('T')[0];

console.log(`📅 Periodo analisi: dal ${dateFrom} ad oggi\n`);

// Crea client XML-RPC
const commonClient = xmlrpc.createSecureClient({
  host: new URL(ODOO_URL).hostname,
  port: 443,
  path: '/xmlrpc/2/common'
});

const objectClient = xmlrpc.createSecureClient({
  host: new URL(ODOO_URL).hostname,
  port: 443,
  path: '/xmlrpc/2/object'
});

function odooCall(model, method, domain, fields) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      fields.uid,
      ODOO_PASSWORD,
      model,
      method,
      domain,
      fields.options || {}
    ], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function authenticate() {
  return new Promise((resolve, reject) => {
    commonClient.methodCall('authenticate', [
      ODOO_DB,
      ODOO_EMAIL,
      ODOO_PASSWORD,
      {}
    ], (err, uid) => {
      if (err) reject(err);
      else resolve(uid);
    });
  });
}

async function main() {
  try {
    console.log('\n🔍 ANALISI PRODOTTO - ULTIMI 6 MESI');
    console.log('='.repeat(100));
    console.log(`📦 Prodotto: ${PRODUCT_NAME}\n`);

    // Autenticazione
    const uid = await authenticate();
    console.log(`✅ Autenticato\n`);

    // 1. CERCA PRODOTTO
    console.log('━'.repeat(100));
    console.log('📦 STEP 1: RICERCA PRODOTTO');
    console.log('━'.repeat(100));

    const products = await odooCall('product.product', 'search_read',
      [[['name', 'ilike', PRODUCT_NAME]]],
      {
        uid,
        options: {
          fields: ['id', 'name', 'default_code', 'barcode', 'list_price', 'standard_price',
                   'qty_available', 'virtual_available', 'incoming_qty', 'outgoing_qty',
                   'uom_id', 'categ_id', 'product_tmpl_id'],
          limit: 1
        }
      }
    );

    if (products.length === 0) {
      console.log('❌ Prodotto non trovato!');
      return;
    }

    const product = products[0];
    const productId = product.id;
    const productTmplId = product.product_tmpl_id[0];

    console.log(`\n✅ Prodotto trovato!`);
    console.log(`   ID: ${productId}`);
    console.log(`   Nome: ${product.name}`);
    console.log(`   Codice: ${product.default_code || 'N/A'}`);
    console.log(`   Barcode: ${product.barcode || 'N/A'}`);
    console.log(`   Categoria: ${product.categ_id[1]}`);
    console.log(`\n💰 PREZZI ATTUALI`);
    console.log(`   Prezzo vendita: CHF ${product.list_price?.toFixed(2)}`);
    console.log(`   Costo standard: CHF ${product.standard_price?.toFixed(2)}`);
    if (product.list_price && product.standard_price) {
      const margin = ((product.list_price - product.standard_price) / product.list_price * 100);
      console.log(`   Margine teorico: ${margin.toFixed(2)}%`);
    }
    console.log(`\n📊 GIACENZE ATTUALI`);
    console.log(`   Disponibile ora: ${product.qty_available} ${product.uom_id[1]}`);
    console.log(`   Giacenza virtuale: ${product.virtual_available} ${product.uom_id[1]}`);
    console.log(`   In arrivo: ${product.incoming_qty}`);
    console.log(`   In uscita: ${product.outgoing_qty}`);

    // 2. FORNITORI
    console.log('\n━'.repeat(100));
    console.log('👥 STEP 2: FORNITORI');
    console.log('━'.repeat(100));

    const suppliers = await odooCall('product.supplierinfo', 'search_read',
      [[['product_tmpl_id', '=', productTmplId]]],
      {
        uid,
        options: {
          fields: ['partner_id', 'product_name', 'product_code', 'price', 'min_qty', 'delay']
        }
      }
    );

    if (suppliers.length > 0) {
      console.log(`\n✅ Trovato ${suppliers.length} fornitore/i:\n`);
      suppliers.forEach(s => {
        console.log(`   📋 ${s.partner_id[1]}`);
        console.log(`      Prezzo: CHF ${s.price?.toFixed(2)}`);
        console.log(`      Qtà min: ${s.min_qty || 1}`);
        console.log(`      Lead time: ${s.delay || 0} giorni`);
        console.log(`      Codice: ${s.product_code || 'N/A'}\n`);
      });
    } else {
      console.log('\n⚠️  Nessun fornitore configurato');
    }

    // 3. ORDINI DI ACQUISTO (ultimi 6 mesi)
    console.log('━'.repeat(100));
    console.log('📥 STEP 3: ORDINI DI ACQUISTO (ultimi 6 mesi)');
    console.log('━'.repeat(100));

    const purchaseLines = await odooCall('purchase.order.line', 'search_read',
      [[
        ['product_id', '=', productId],
        ['create_date', '>=', dateFrom]
      ]],
      {
        uid,
        options: {
          fields: ['order_id', 'partner_id', 'product_qty', 'qty_received', 'price_unit',
                   'price_subtotal', 'date_order', 'state', 'create_date'],
          order: 'date_order desc'
        }
      }
    );

    let totalPurchased = 0;
    let totalPurchaseCost = 0;
    let totalReceived = 0;
    const purchaseBySupplier = {};

    console.log(`\n✅ Trovati ${purchaseLines.length} ordini di acquisto:\n`);

    purchaseLines.forEach(line => {
      const supplier = line.partner_id[1];
      const orderName = line.order_id[1];

      console.log(`   📦 ${orderName} - ${supplier}`);
      console.log(`      Data: ${line.date_order}`);
      console.log(`      Ordinato: ${line.product_qty} | Ricevuto: ${line.qty_received}`);
      console.log(`      Prezzo: CHF ${line.price_unit?.toFixed(2)} | Totale: CHF ${line.price_subtotal?.toFixed(2)}`);
      console.log(`      Stato: ${line.state}\n`);

      totalPurchased += line.product_qty;
      totalReceived += line.qty_received;
      totalPurchaseCost += line.price_subtotal || 0;

      if (!purchaseBySupplier[supplier]) {
        purchaseBySupplier[supplier] = { qty: 0, cost: 0, orders: 0 };
      }
      purchaseBySupplier[supplier].qty += line.product_qty;
      purchaseBySupplier[supplier].cost += line.price_subtotal || 0;
      purchaseBySupplier[supplier].orders += 1;
    });

    console.log(`\n📊 TOTALE ACQUISTI (6 mesi):`);
    console.log(`   Ordinato: ${totalPurchased} ${product.uom_id[1]}`);
    console.log(`   Ricevuto: ${totalReceived} ${product.uom_id[1]}`);
    console.log(`   Speso: CHF ${totalPurchaseCost.toFixed(2)}`);
    console.log(`   Prezzo medio acquisto: CHF ${totalPurchased > 0 ? (totalPurchaseCost / totalPurchased).toFixed(2) : '0.00'}`);

    console.log(`\n📊 ACQUISTI PER FORNITORE:`);
    Object.entries(purchaseBySupplier).forEach(([supplier, data]) => {
      console.log(`   ${supplier}:`);
      console.log(`      Ordini: ${data.orders}`);
      console.log(`      Quantità: ${data.qty} ${product.uom_id[1]}`);
      console.log(`      Speso: CHF ${data.cost.toFixed(2)}`);
      console.log(`      Prezzo medio: CHF ${(data.cost / data.qty).toFixed(2)}\n`);
    });

    // 4. ORDINI DI VENDITA (ultimi 6 mesi)
    console.log('━'.repeat(100));
    console.log('📤 STEP 4: ORDINI DI VENDITA (ultimi 6 mesi)');
    console.log('━'.repeat(100));

    const saleLines = await odooCall('sale.order.line', 'search_read',
      [[
        ['product_id', '=', productId],
        ['create_date', '>=', dateFrom]
      ]],
      {
        uid,
        options: {
          fields: ['order_id', 'order_partner_id', 'product_uom_qty', 'qty_delivered',
                   'price_unit', 'price_subtotal', 'create_date', 'state'],
          order: 'create_date desc'
        }
      }
    );

    let totalSold = 0;
    let totalDelivered = 0;
    let totalRevenue = 0;
    const salesByCustomer = {};

    console.log(`\n✅ Trovati ${saleLines.length} ordini di vendita:\n`);

    saleLines.forEach(line => {
      const customer = line.order_partner_id[1];
      const orderName = line.order_id[1];

      console.log(`   📦 ${orderName} - ${customer}`);
      console.log(`      Data: ${line.create_date.split(' ')[0]}`);
      console.log(`      Ordinato: ${line.product_uom_qty} | Consegnato: ${line.qty_delivered}`);
      console.log(`      Prezzo: CHF ${line.price_unit?.toFixed(2)} | Totale: CHF ${line.price_subtotal?.toFixed(2)}`);
      console.log(`      Stato: ${line.state}\n`);

      totalSold += line.product_uom_qty;
      totalDelivered += line.qty_delivered;
      totalRevenue += line.price_subtotal || 0;

      if (!salesByCustomer[customer]) {
        salesByCustomer[customer] = { qty: 0, revenue: 0, orders: 0 };
      }
      salesByCustomer[customer].qty += line.product_uom_qty;
      salesByCustomer[customer].revenue += line.price_subtotal || 0;
      salesByCustomer[customer].orders += 1;
    });

    console.log(`\n📊 TOTALE VENDITE (6 mesi):`);
    console.log(`   Venduto: ${totalSold} ${product.uom_id[1]}`);
    console.log(`   Consegnato: ${totalDelivered} ${product.uom_id[1]}`);
    console.log(`   Fatturato: CHF ${totalRevenue.toFixed(2)}`);
    console.log(`   Prezzo medio vendita: CHF ${totalSold > 0 ? (totalRevenue / totalSold).toFixed(2) : '0.00'}`);

    console.log(`\n📊 VENDITE PER CLIENTE (Top 10):`);
    const topCustomers = Object.entries(salesByCustomer)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10);

    topCustomers.forEach(([customer, data], index) => {
      console.log(`   ${index + 1}. ${customer}:`);
      console.log(`      Ordini: ${data.orders}`);
      console.log(`      Quantità: ${data.qty} ${product.uom_id[1]}`);
      console.log(`      Fatturato: CHF ${data.revenue.toFixed(2)}`);
      console.log(`      Prezzo medio: CHF ${(data.revenue / data.qty).toFixed(2)}\n`);
    });

    // 5. ANALISI MARGINI
    console.log('━'.repeat(100));
    console.log('💰 STEP 5: ANALISI MARGINI E PROFITTO');
    console.log('━'.repeat(100));

    const profit = totalRevenue - totalPurchaseCost;
    const marginPercent = totalRevenue > 0 ? ((profit / totalRevenue) * 100) : 0;
    const roi = totalPurchaseCost > 0 ? ((profit / totalPurchaseCost) * 100) : 0;

    console.log(`\n📊 PERFORMANCE FINANZIARIA (6 mesi):`);
    console.log(`   💵 Fatturato totale:     CHF ${totalRevenue.toFixed(2)}`);
    console.log(`   💸 Costi totali:         CHF ${totalPurchaseCost.toFixed(2)}`);
    console.log(`   💰 Profitto netto:       CHF ${profit.toFixed(2)}`);
    console.log(`   📈 Margine %:            ${marginPercent.toFixed(2)}%`);
    console.log(`   📊 ROI:                  ${roi.toFixed(2)}%`);

    // 6. ROTAZIONE E PREVISIONE
    console.log('\n━'.repeat(100));
    console.log('📊 STEP 6: ROTAZIONE E SUGGERIMENTI');
    console.log('━'.repeat(100));

    const monthlyAvgSales = totalSold / 6;
    const weeklyAvgSales = monthlyAvgSales / 4;
    const avgLeadTime = suppliers.length > 0 ? suppliers[0].delay : 7;
    const safetyStock = weeklyAvgSales * 2; // 2 settimane di scorta
    const reorderPoint = (weeklyAvgSales * avgLeadTime / 7) + safetyStock;
    const optimalOrder = monthlyAvgSales; // ordine mensile

    console.log(`\n📊 STATISTICHE ROTAZIONE:`);
    console.log(`   Media vendita mensile:   ${monthlyAvgSales.toFixed(2)} ${product.uom_id[1]}`);
    console.log(`   Media vendita settimanale: ${weeklyAvgSales.toFixed(2)} ${product.uom_id[1]}`);
    console.log(`   Lead time fornitore:     ${avgLeadTime} giorni`);
    console.log(`   Giacenza attuale:        ${product.qty_available} ${product.uom_id[1]}`);
    console.log(`   In arrivo:               ${product.incoming_qty} ${product.uom_id[1]}`);

    console.log(`\n💡 SUGGERIMENTI ORDINE:`);
    console.log(`   🔴 Punto di riordino:    ${reorderPoint.toFixed(0)} ${product.uom_id[1]}`);
    console.log(`   🟡 Scorta di sicurezza:  ${safetyStock.toFixed(0)} ${product.uom_id[1]}`);
    console.log(`   🟢 Quantità ottimale:    ${optimalOrder.toFixed(0)} ${product.uom_id[1]}`);

    const currentStock = product.qty_available + product.incoming_qty;
    const daysLeft = weeklyAvgSales > 0 ? (currentStock / weeklyAvgSales) * 7 : 999;

    console.log(`\n⏰ SITUAZIONE ATTUALE:`);
    console.log(`   Stock totale (attuale + in arrivo): ${currentStock.toFixed(0)} ${product.uom_id[1]}`);
    console.log(`   Giorni di copertura:     ${daysLeft.toFixed(1)} giorni`);

    if (currentStock < reorderPoint) {
      const toOrder = optimalOrder - currentStock;
      console.log(`\n   🚨 AZIONE RICHIESTA: Ordinare ${toOrder.toFixed(0)} ${product.uom_id[1]}`);
    } else if (daysLeft < avgLeadTime + 7) {
      console.log(`\n   ⚠️  ATTENZIONE: Stock sufficiente per solo ${daysLeft.toFixed(0)} giorni`);
      console.log(`      Considera di ordinare presto (lead time: ${avgLeadTime} giorni)`);
    } else {
      console.log(`\n   ✅ Stock OK per i prossimi ${daysLeft.toFixed(0)} giorni`);
    }

    // 7. RIEPILOGO FINALE
    console.log('\n━'.repeat(100));
    console.log('📋 RIEPILOGO ESECUTIVO');
    console.log('━'.repeat(100));

    console.log(`\n📦 PRODOTTO: ${product.name}`);
    console.log(`\n🔢 NUMERI CHIAVE (ultimi 6 mesi):`);
    console.log(`   • Acquistato:     ${totalPurchased} ${product.uom_id[1]} da ${Object.keys(purchaseBySupplier).length} fornitori`);
    console.log(`   • Venduto:        ${totalSold} ${product.uom_id[1]} a ${Object.keys(salesByCustomer).length} clienti`);
    console.log(`   • Stock attuale:  ${product.qty_available} ${product.uom_id[1]}`);
    console.log(`   • In arrivo:      ${product.incoming_qty} ${product.uom_id[1]}`);
    console.log(`\n💰 PERFORMANCE ECONOMICA:`);
    console.log(`   • Fatturato:      CHF ${totalRevenue.toFixed(2)}`);
    console.log(`   • Costi:          CHF ${totalPurchaseCost.toFixed(2)}`);
    console.log(`   • Profitto:       CHF ${profit.toFixed(2)}`);
    console.log(`   • Margine:        ${marginPercent.toFixed(2)}%`);
    console.log(`\n👥 TOP FORNITORE:`);
    const topSupplier = Object.entries(purchaseBySupplier)
      .sort((a, b) => b[1].qty - a[1].qty)[0];
    if (topSupplier) {
      console.log(`   • ${topSupplier[0]}`);
      console.log(`   • Acquistato: ${topSupplier[1].qty} ${product.uom_id[1]} per CHF ${topSupplier[1].cost.toFixed(2)}`);
    }
    console.log(`\n👥 TOP CLIENTE:`);
    if (topCustomers.length > 0) {
      const top1 = topCustomers[0];
      console.log(`   • ${top1[0]}`);
      console.log(`   • Venduto: ${top1[1].qty} ${product.uom_id[1]} per CHF ${top1[1].revenue.toFixed(2)}`);
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ ANALISI COMPLETATA!\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
  }
}

main();
