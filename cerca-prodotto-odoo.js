const xmlrpc = require('xmlrpc');

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Nome prodotto da cercare
const PRODUCT_NAME = 'POLPA DI POMODORO SUPER PIZZA ARDITA BAG BOX 10KG CRT POL';

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

async function searchProduct(uid) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      'product.product',
      'search_read',
      [[['name', 'ilike', PRODUCT_NAME]]],
      {
        fields: [
          'id',
          'name',
          'default_code',
          'barcode',
          'type',
          'categ_id',
          'list_price',
          'standard_price',
          'qty_available',
          'virtual_available',
          'incoming_qty',
          'outgoing_qty',
          'seller_ids',
          'uom_id',
          'uom_po_id',
          'weight',
          'volume',
          'active',
          'description',
          'description_sale',
          'description_purchase'
        ]
      }
    ], (err, products) => {
      if (err) reject(err);
      else resolve(products);
    });
  });
}

async function getSupplierInfo(uid, productId) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      'product.supplierinfo',
      'search_read',
      [[['product_id', '=', productId]]],
      {
        fields: [
          'partner_id',
          'price',
          'min_qty',
          'delay',
          'product_name',
          'product_code'
        ]
      }
    ], (err, suppliers) => {
      if (err) reject(err);
      else resolve(suppliers);
    });
  });
}

async function getStockMoves(uid, productId) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      'stock.move',
      'search_read',
      [[
        ['product_id', '=', productId],
        ['state', '=', 'done']
      ]],
      {
        fields: ['date', 'product_uom_qty', 'picking_id', 'location_id', 'location_dest_id'],
        limit: 10,
        order: 'date desc'
      }
    ], (err, moves) => {
      if (err) reject(err);
      else resolve(moves);
    });
  });
}

async function getPurchaseOrderLines(uid, productId) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      'purchase.order.line',
      'search_read',
      [[['product_id', '=', productId]]],
      {
        fields: ['order_id', 'product_qty', 'price_unit', 'date_planned', 'state'],
        limit: 10,
        order: 'date_planned desc'
      }
    ], (err, lines) => {
      if (err) reject(err);
      else resolve(lines);
    });
  });
}

async function getSaleOrderLines(uid, productId) {
  return new Promise((resolve, reject) => {
    objectClient.methodCall('execute_kw', [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      'sale.order.line',
      'search_read',
      [[['product_id', '=', productId]]],
      {
        fields: ['order_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'state'],
        limit: 10,
        order: 'create_date desc'
      }
    ], (err, lines) => {
      if (err) reject(err);
      else resolve(lines);
    });
  });
}

async function main() {
  try {
    console.log('\n🔍 RICERCA PRODOTTO IN ODOO');
    console.log('='.repeat(80));
    console.log(`📦 Prodotto: ${PRODUCT_NAME}\n`);

    // Autenticazione
    console.log('🔐 Autenticazione in corso...');
    const uid = await authenticate();
    console.log(`✅ Autenticato con UID: ${uid}\n`);

    // Cerca prodotto
    console.log('🔎 Ricerca prodotto...');
    const products = await searchProduct(uid);

    if (products.length === 0) {
      console.log('❌ Prodotto non trovato in Odoo!');
      return;
    }

    console.log(`✅ Trovato ${products.length} prodotto(i):\n`);

    for (const product of products) {
      console.log('━'.repeat(80));
      console.log('📦 INFORMAZIONI PRODOTTO');
      console.log('━'.repeat(80));
      console.log(`ID Odoo:           ${product.id}`);
      console.log(`Nome:              ${product.name}`);
      console.log(`Codice interno:    ${product.default_code || 'N/A'}`);
      console.log(`Barcode:           ${product.barcode || 'N/A'}`);
      console.log(`Tipo:              ${product.type}`);
      console.log(`Categoria:         ${product.categ_id ? product.categ_id[1] : 'N/A'}`);
      console.log(`Attivo:            ${product.active ? 'Sì' : 'No'}`);
      console.log(`\n💰 PREZZI`);
      console.log(`Prezzo vendita:    CHF ${product.list_price?.toFixed(2) || '0.00'}`);
      console.log(`Costo standard:    CHF ${product.standard_price?.toFixed(2) || '0.00'}`);

      if (product.list_price && product.standard_price) {
        const margin = ((product.list_price - product.standard_price) / product.list_price * 100);
        console.log(`Margine:           ${margin.toFixed(2)}%`);
      }

      console.log(`\n📊 GIACENZE`);
      console.log(`Disponibile:       ${product.qty_available || 0} ${product.uom_id ? product.uom_id[1] : ''}`);
      console.log(`Virtuale:          ${product.virtual_available || 0} ${product.uom_id ? product.uom_id[1] : ''}`);
      console.log(`In arrivo:         ${product.incoming_qty || 0}`);
      console.log(`In uscita:         ${product.outgoing_qty || 0}`);

      console.log(`\n📏 UNITÀ DI MISURA`);
      console.log(`UdM vendita:       ${product.uom_id ? product.uom_id[1] : 'N/A'}`);
      console.log(`UdM acquisto:      ${product.uom_po_id ? product.uom_po_id[1] : 'N/A'}`);
      console.log(`Peso:              ${product.weight || 0} kg`);
      console.log(`Volume:            ${product.volume || 0} m³`);

      if (product.description_sale) {
        console.log(`\n📝 Descrizione vendita:\n${product.description_sale}`);
      }
      if (product.description_purchase) {
        console.log(`\n📝 Descrizione acquisto:\n${product.description_purchase}`);
      }

      // Cerca fornitori
      console.log('\n━'.repeat(80));
      console.log('👥 FORNITORI');
      console.log('━'.repeat(80));
      const suppliers = await getSupplierInfo(uid, product.id);

      if (suppliers.length > 0) {
        for (const supplier of suppliers) {
          console.log(`\nFornitore:         ${supplier.partner_id[1]}`);
          console.log(`Prezzo:            CHF ${supplier.price?.toFixed(2) || '0.00'}`);
          console.log(`Qtà minima:        ${supplier.min_qty || 1}`);
          console.log(`Tempo consegna:    ${supplier.delay || 0} giorni`);
          if (supplier.product_code) {
            console.log(`Codice fornitore:  ${supplier.product_code}`);
          }
        }
      } else {
        console.log('Nessun fornitore configurato');
      }

      // Ultimi ordini di acquisto
      console.log('\n━'.repeat(80));
      console.log('📥 ULTIMI ORDINI DI ACQUISTO');
      console.log('━'.repeat(80));
      const purchaseLines = await getPurchaseOrderLines(uid, product.id);

      if (purchaseLines.length > 0) {
        for (const line of purchaseLines) {
          console.log(`\nOrdine:            ${line.order_id[1]}`);
          console.log(`Quantità:          ${line.product_qty}`);
          console.log(`Prezzo unitario:   CHF ${line.price_unit?.toFixed(2)}`);
          console.log(`Data prevista:     ${line.date_planned}`);
          console.log(`Stato:             ${line.state}`);
        }
      } else {
        console.log('Nessun ordine di acquisto trovato');
      }

      // Ultimi ordini di vendita
      console.log('\n━'.repeat(80));
      console.log('📤 ULTIMI ORDINI DI VENDITA');
      console.log('━'.repeat(80));
      const saleLines = await getSaleOrderLines(uid, product.id);

      if (saleLines.length > 0) {
        let totalSold = 0;
        let totalRevenue = 0;

        for (const line of saleLines) {
          console.log(`\nOrdine:            ${line.order_id[1]}`);
          console.log(`Quantità:          ${line.product_uom_qty}`);
          console.log(`Prezzo unitario:   CHF ${line.price_unit?.toFixed(2)}`);
          console.log(`Subtotale:         CHF ${line.price_subtotal?.toFixed(2)}`);
          console.log(`Stato:             ${line.state}`);

          totalSold += line.product_uom_qty;
          totalRevenue += line.price_subtotal || 0;
        }

        console.log('\n📊 STATISTICHE VENDITE (ultimi ordini)');
        console.log(`Totale venduto:    ${totalSold} unità`);
        console.log(`Ricavo totale:     CHF ${totalRevenue.toFixed(2)}`);
        console.log(`Prezzo medio:      CHF ${(totalRevenue / totalSold).toFixed(2)}`);
      } else {
        console.log('Nessun ordine di vendita trovato');
      }

      // Ultimi movimenti di magazzino
      console.log('\n━'.repeat(80));
      console.log('📦 ULTIMI MOVIMENTI MAGAZZINO');
      console.log('━'.repeat(80));
      const moves = await getStockMoves(uid, product.id);

      if (moves.length > 0) {
        for (const move of moves) {
          console.log(`\nData:              ${move.date}`);
          console.log(`Quantità:          ${move.product_uom_qty}`);
          console.log(`Picking:           ${move.picking_id ? move.picking_id[1] : 'N/A'}`);
          console.log(`Da:                ${move.location_id ? move.location_id[1] : 'N/A'}`);
          console.log(`A:                 ${move.location_dest_id ? move.location_dest_id[1] : 'N/A'}`);
        }
      } else {
        console.log('Nessun movimento di magazzino trovato');
      }

      console.log('\n' + '━'.repeat(80));
    }

    console.log('\n✅ Analisi completata!\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error);
  }
}

main();
