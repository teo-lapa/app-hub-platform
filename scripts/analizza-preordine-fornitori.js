#!/usr/bin/env node

/**
 * Script per analizzare i prodotti PRE-ORDINE raggruppati per fornitore
 * Usage: node analizza-preordine-fornitori.js
 */

const xmlrpc = require('xmlrpc');
const fs = require('fs');

// ============================================================================
// CONFIGURAZIONE ODOO
// ============================================================================

const ODOO_URL = 'lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859';
const ODOO_USERNAME = 'admin'; // Modifica con le tue credenziali
const ODOO_PASSWORD = 'admin'; // Modifica con la tua password

// ID Tag PRE-ORDINE
const PRE_ORDINE_TAG_ID = 314;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createClient(path) {
  return xmlrpc.createSecureClient({
    host: ODOO_URL,
    port: 443,
    path: path
  });
}

function odooCall(model, method, args, kwargs = {}) {
  return new Promise((resolve, reject) => {
    const objectClient = createClient('/xmlrpc/2/object');

    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      global.uid,
      ODOO_PASSWORD,
      model,
      method,
      args,
      kwargs
    ], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ============================================================================
// AUTENTICAZIONE
// ============================================================================

async function authenticate() {
  console.log('Autenticazione in corso...');

  const commonClient = createClient('/xmlrpc/2/common');

  return new Promise((resolve, reject) => {
    commonClient.methodCall('authenticate', [
      ODOO_DB,
      ODOO_USERNAME,
      ODOO_PASSWORD,
      {}
    ], (err, uid) => {
      if (err) reject(err);
      else if (!uid) reject(new Error('Autenticazione fallita'));
      else {
        console.log(`✓ Autenticato con UID: ${uid}`);
        global.uid = uid;
        resolve(uid);
      }
    });
  });
}

// ============================================================================
// RICERCA PRODOTTI PRE-ORDINE
// ============================================================================

async function getPreordineProducts() {
  console.log(`\nCerco prodotti con tag ID ${PRE_ORDINE_TAG_ID}...`);

  const products = await odooCall(
    'product.product',
    'search_read',
    [[['categ_id', '=', PRE_ORDINE_TAG_ID]]],
    {
      fields: [
        'id',
        'name',
        'default_code',
        'seller_ids',
        'list_price',
        'standard_price',
        'qty_available',
        'virtual_available',
        'uom_id'
      ],
      limit: 2000
    }
  );

  console.log(`✓ Trovati ${products.length} prodotti PRE-ORDINE`);
  return products;
}

// ============================================================================
// OTTIENI INFO FORNITORI
// ============================================================================

async function getSupplierInfo(sellerIds) {
  if (!sellerIds || sellerIds.length === 0) {
    return [];
  }

  const supplierInfos = await odooCall(
    'product.supplierinfo',
    'read',
    [sellerIds],
    { fields: ['partner_id', 'price', 'min_qty', 'delay', 'product_code'] }
  );

  return supplierInfos;
}

// ============================================================================
// ANALIZZA E RAGGRUPPA
// ============================================================================

async function analyzeBySupplier(products) {
  console.log('\nRaggruppamento per fornitore in corso...');

  const suppliersMap = {};
  const productsWithoutSupplier = [];

  for (const product of products) {
    // Info base prodotto
    const productInfo = {
      id: product.id,
      name: product.name,
      sku: product.default_code || 'N/A',
      list_price: product.list_price,
      cost_price: product.standard_price,
      qty_available: product.qty_available,
      virtual_available: product.virtual_available,
      uom: product.uom_id ? product.uom_id[1] : 'Unità'
    };

    // Se ha fornitori configurati
    if (product.seller_ids && product.seller_ids.length > 0) {
      const supplierInfos = await getSupplierInfo(product.seller_ids);

      for (const supplierInfo of supplierInfos) {
        const supplierName = supplierInfo.partner_id[1];
        const supplierId = supplierInfo.partner_id[0];

        // Inizializza fornitore se non esiste
        if (!suppliersMap[supplierName]) {
          suppliersMap[supplierName] = {
            supplier_id: supplierId,
            products: [],
            total_products: 0,
            total_value: 0,
            total_stock: 0,
            avg_price: 0
          };
        }

        // Aggiungi info fornitore al prodotto
        const productWithSupplier = {
          ...productInfo,
          supplier_price: supplierInfo.price,
          min_qty: supplierInfo.min_qty,
          lead_time: supplierInfo.delay,
          supplier_code: supplierInfo.product_code || 'N/A'
        };

        // Aggiungi al fornitore
        suppliersMap[supplierName].products.push(productWithSupplier);
        suppliersMap[supplierName].total_products += 1;
        suppliersMap[supplierName].total_value += product.list_price * product.qty_available;
        suppliersMap[supplierName].total_stock += product.qty_available;
      }
    } else {
      // Nessun fornitore configurato
      productsWithoutSupplier.push(productInfo);
    }
  }

  // Calcola media prezzi per fornitore
  Object.keys(suppliersMap).forEach(supplierName => {
    const data = suppliersMap[supplierName];
    if (data.total_products > 0) {
      data.avg_price = data.products.reduce((sum, p) => sum + p.list_price, 0) / data.total_products;
    }
  });

  console.log(`✓ Trovati ${Object.keys(suppliersMap).length} fornitori`);
  console.log(`✓ Prodotti senza fornitore: ${productsWithoutSupplier.length}`);

  return { suppliersMap, productsWithoutSupplier };
}

// ============================================================================
// STAMPA REPORT
// ============================================================================

function printReport(suppliersMap, productsWithoutSupplier) {
  console.log('\n' + '='.repeat(80));
  console.log(' REPORT PRODOTTI PRE-ORDINE PER FORNITORE '.padStart(60, '=').padEnd(80, '='));
  console.log('='.repeat(80));
  console.log(`Data: ${new Date().toLocaleString('it-IT')}`);
  console.log(`Totale fornitori: ${Object.keys(suppliersMap).length}`);
  console.log(`Prodotti senza fornitore: ${productsWithoutSupplier.length}`);
  console.log('='.repeat(80));

  // Ordina fornitori per numero prodotti
  const sortedSuppliers = Object.entries(suppliersMap)
    .sort((a, b) => b[1].total_products - a[1].total_products);

  // TOP 10 FORNITORI
  console.log('\n' + '-'.repeat(80));
  console.log(' TOP 10 FORNITORI PER NUMERO PRODOTTI '.padStart(60, '-').padEnd(80, '-'));
  console.log('-'.repeat(80));

  sortedSuppliers.slice(0, 10).forEach(([supplierName, data], i) => {
    console.log(`\n${i + 1}. ${supplierName}`);
    console.log(`   Prodotti:      ${data.total_products}`);
    console.log(`   Prezzo medio:  CHF ${data.avg_price.toFixed(2)}`);
    console.log(`   Valore stock:  CHF ${data.total_value.toFixed(2)}`);
    console.log(`   Stock totale:  ${data.total_stock.toFixed(0)} unità`);

    // Primi 3 prodotti
    console.log('   Campione prodotti:');
    data.products.slice(0, 3).forEach(product => {
      console.log(`     - [${product.sku}] ${product.name}`);
      console.log(`       Prezzo: CHF ${product.list_price.toFixed(2)} | Stock: ${product.qty_available.toFixed(0)} ${product.uom}`);
    });

    if (data.total_products > 3) {
      console.log(`     ... e altri ${data.total_products - 3} prodotti`);
    }
  });

  // TUTTI I FORNITORI (RIEPILOGO)
  console.log('\n' + '-'.repeat(80));
  console.log(' ELENCO COMPLETO FORNITORI '.padStart(60, '-').padEnd(80, '-'));
  console.log('-'.repeat(80));
  console.log('Fornitore'.padEnd(40) + 'Prodotti'.padStart(10) + 'Prezzo Medio'.padStart(15) + 'Stock Totale'.padStart(15));
  console.log('-'.repeat(80));

  sortedSuppliers.forEach(([supplierName, data]) => {
    console.log(
      supplierName.substring(0, 40).padEnd(40) +
      data.total_products.toString().padStart(10) +
      `CHF ${data.avg_price.toFixed(2)}`.padStart(15) +
      data.total_stock.toFixed(0).padStart(15)
    );
  });

  // PRODOTTI SENZA FORNITORE
  if (productsWithoutSupplier.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log(' PRODOTTI SENZA FORNITORE CONFIGURATO '.padStart(60, '-').padEnd(80, '-'));
    console.log('-'.repeat(80));
    console.log(`Totale: ${productsWithoutSupplier.length} prodotti`);
    console.log('\nPrimi 10 prodotti:');

    productsWithoutSupplier.slice(0, 10).forEach(product => {
      console.log(`  - [${product.sku}] ${product.name}`);
      console.log(`    Prezzo: CHF ${product.list_price.toFixed(2)} | Stock: ${product.qty_available.toFixed(0)} ${product.uom}`);
    });

    if (productsWithoutSupplier.length > 10) {
      console.log(`\n  ... e altri ${productsWithoutSupplier.length - 10} prodotti`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// ============================================================================
// EXPORT JSON
// ============================================================================

function exportJson(suppliersMap, productsWithoutSupplier) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `preordine_fornitori_${timestamp}.json`;

  const output = {
    timestamp: new Date().toISOString(),
    total_suppliers: Object.keys(suppliersMap).length,
    total_products_without_supplier: productsWithoutSupplier.length,
    suppliers: suppliersMap,
    products_without_supplier: productsWithoutSupplier
  };

  fs.writeFileSync(filename, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✓ Risultati esportati in: ${filename}`);
}

// ============================================================================
// EXPORT CSV
// ============================================================================

function exportCsv(suppliersMap, productsWithoutSupplier) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `preordine_fornitori_${timestamp}.csv`;

  const rows = [];

  // Header
  rows.push([
    'Fornitore',
    'SKU',
    'Nome Prodotto',
    'Prezzo Listino',
    'Prezzo Fornitore',
    'Costo Standard',
    'Stock Disponibile',
    'Stock Virtuale',
    'UdM',
    'Qty Minima',
    'Lead Time (giorni)',
    'Codice Fornitore'
  ].join(','));

  // Prodotti con fornitore
  Object.entries(suppliersMap).forEach(([supplierName, data]) => {
    data.products.forEach(product => {
      rows.push([
        `"${supplierName}"`,
        `"${product.sku}"`,
        `"${product.name.replace(/"/g, '""')}"`,
        product.list_price.toFixed(2),
        product.supplier_price?.toFixed(2) || '',
        product.cost_price.toFixed(2),
        product.qty_available.toFixed(0),
        product.virtual_available.toFixed(0),
        `"${product.uom}"`,
        product.min_qty || '',
        product.lead_time || '',
        `"${product.supplier_code || ''}"`
      ].join(','));
    });
  });

  // Prodotti senza fornitore
  productsWithoutSupplier.forEach(product => {
    rows.push([
      '"SENZA FORNITORE"',
      `"${product.sku}"`,
      `"${product.name.replace(/"/g, '""')}"`,
      product.list_price.toFixed(2),
      '',
      product.cost_price.toFixed(2),
      product.qty_available.toFixed(0),
      product.virtual_available.toFixed(0),
      `"${product.uom}"`,
      '',
      '',
      ''
    ].join(','));
  });

  fs.writeFileSync(filename, '\uFEFF' + rows.join('\n'), 'utf-8'); // BOM per Excel
  console.log(`✓ CSV esportato in: ${filename}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    // Autentica
    await authenticate();

    // Ottieni prodotti PRE-ORDINE
    const products = await getPreordineProducts();

    // Analizza e raggruppa per fornitore
    const { suppliersMap, productsWithoutSupplier } = await analyzeBySupplier(products);

    // Stampa report
    printReport(suppliersMap, productsWithoutSupplier);

    // Export
    exportJson(suppliersMap, productsWithoutSupplier);
    exportCsv(suppliersMap, productsWithoutSupplier);

    console.log('\n✓ Analisi completata!');
  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Esegui
main();
