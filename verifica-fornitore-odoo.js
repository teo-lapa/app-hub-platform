const xmlrpc = require('xmlrpc');

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODUCT_ID = 22530;

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

async function getProductTemplate(uid, productId) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      'product.product',
      'read',
      [[productId]],
      {
        fields: ['product_tmpl_id', 'seller_ids']
      }
    ], (err, products) => {
      if (err) reject(err);
      else resolve(products);
    });
  });
}

async function getSupplierInfo(uid, productTmplId) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      'product.supplierinfo',
      'search_read',
      [[['product_tmpl_id', '=', productTmplId]]],
      {
        fields: [
          'id',
          'partner_id',
          'product_id',
          'product_tmpl_id',
          'product_name',
          'product_code',
          'price',
          'min_qty',
          'delay',
          'currency_id',
          'company_id'
        ]
      }
    ], (err, suppliers) => {
      if (err) reject(err);
      else resolve(suppliers);
    });
  });
}

async function main() {
  try {
    console.log('\n🔍 VERIFICA FORNITORE PRODOTTO');
    console.log('='.repeat(80));

    const uid = await authenticate();
    console.log(`✅ Autenticato con UID: ${uid}\n`);

    // Get product info
    console.log(`📦 Cerco info prodotto ID: ${PRODUCT_ID}...`);
    const products = await getProductTemplate(uid, PRODUCT_ID);

    if (products.length === 0) {
      console.log('❌ Prodotto non trovato!');
      return;
    }

    const product = products[0];
    console.log(`Product Template ID: ${product.product_tmpl_id[0]}`);
    console.log(`Seller IDs nel prodotto: ${JSON.stringify(product.seller_ids)}\n`);

    // Get supplier info usando product_tmpl_id
    console.log('🔎 Cerco fornitori usando product_tmpl_id...');
    const suppliers = await getSupplierInfo(uid, product.product_tmpl_id[0]);

    console.log(`\n✅ Trovati ${suppliers.length} fornitore/i:\n`);
    console.log('━'.repeat(80));

    for (const supplier of suppliers) {
      console.log(`\n📋 FORNITORE ${supplier.id}`);
      console.log(`Partner:           ${supplier.partner_id[1]}`);
      console.log(`Product ID:        ${supplier.product_id || 'N/A (tutti i varianti)'}`);
      console.log(`Product Tmpl ID:   ${supplier.product_tmpl_id[0]}`);
      console.log(`Nome prodotto:     ${supplier.product_name || 'N/A'}`);
      console.log(`Codice prodotto:   ${supplier.product_code || 'N/A'}`);
      console.log(`Prezzo:            ${supplier.price} ${supplier.currency_id ? supplier.currency_id[1] : ''}`);
      console.log(`Qtà minima:        ${supplier.min_qty || 1}`);
      console.log(`Tempo consegna:    ${supplier.delay || 0} giorni`);
      console.log(`Azienda:           ${supplier.company_id ? supplier.company_id[1] : 'N/A'}`);
      console.log('━'.repeat(80));
    }

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error);
  }
}

main();
