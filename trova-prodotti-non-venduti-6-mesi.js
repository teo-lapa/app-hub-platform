/**
 * ANALISI PRODOTTI NON VENDUTI - ULTIMI 6 MESI
 *
 * Questo script si connette a Odoo e identifica tutti i prodotti
 * che non sono stati venduti negli ultimi 6 mesi.
 *
 * Output: Lista prodotti con codice, nome e data ultima vendita
 */

// Configurazione Odoo (da .env.local)
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Data 6 mesi fa
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
const dateFrom = sixMonthsAgo.toISOString().split('T')[0];

console.log('\n' + '='.repeat(100));
console.log('📊 ANALISI PRODOTTI NON VENDUTI - ULTIMI 6 MESI');
console.log('='.repeat(100));
console.log(`📅 Periodo analisi: dal ${dateFrom} ad oggi`);
console.log(`🔗 Odoo URL: ${ODOO_URL}`);
console.log('='.repeat(100) + '\n');

/**
 * Autentica con Odoo e ottiene il session cookie
 */
async function authenticateOdoo() {
  console.log('🔐 STEP 1: Autenticazione con Odoo...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_EMAIL,
        password: ODOO_PASSWORD
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error('Autenticazione fallita: ' + JSON.stringify(data.error));
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('Nessun session_id ricevuto');
  }

  console.log(`✅ Autenticazione riuscita! UID: ${data.result.uid}\n`);
  return `session_id=${sessionMatch[1]}`;
}

/**
 * Chiama un metodo Odoo via JSON-RPC
 */
async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs: kwargs || {}
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('❌ Errore chiamata Odoo:', data.error);
    throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
  }

  return data.result;
}

/**
 * Ottiene tutti i prodotti attivi da Odoo
 */
async function getAllActiveProducts(cookies) {
  console.log('📦 STEP 2: Recupero tutti i prodotti attivi...');

  let allProducts = [];
  let offset = 0;
  const limit = 500; // Batch size
  let hasMore = true;

  while (hasMore) {
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [
        [
          ['active', '=', true],
          ['sale_ok', '=', true], // Solo prodotti vendibili
        ]
      ],
      {
        fields: ['id', 'name', 'default_code', 'barcode', 'list_price', 'qty_available', 'categ_id'],
        limit: limit,
        offset: offset,
        order: 'id asc'
      }
    );

    allProducts = allProducts.concat(products);
    offset += limit;
    hasMore = products.length === limit;

    console.log(`   Recuperati ${allProducts.length} prodotti...`);
  }

  console.log(`✅ Totale prodotti attivi: ${allProducts.length}\n`);
  return allProducts;
}

/**
 * Ottiene tutti i prodotti venduti negli ultimi 6 mesi
 */
async function getSoldProductIds(cookies) {
  console.log('📈 STEP 3: Recupero vendite ultimi 6 mesi...');

  let allSoldProductIds = new Set();
  let offset = 0;
  const limit = 1000; // Batch size
  let hasMore = true;

  while (hasMore) {
    const saleLines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [
        [
          ['create_date', '>=', dateFrom],
          ['state', 'in', ['sale', 'done']] // Solo ordini confermati o completati
        ]
      ],
      {
        fields: ['product_id', 'product_uom_qty', 'create_date'],
        limit: limit,
        offset: offset,
        order: 'create_date desc'
      }
    );

    saleLines.forEach(line => {
      if (line.product_id && line.product_id[0]) {
        allSoldProductIds.add(line.product_id[0]);
      }
    });

    offset += limit;
    hasMore = saleLines.length === limit;

    console.log(`   Processate ${offset} righe ordine... (${allSoldProductIds.size} prodotti unici venduti)`);
  }

  console.log(`✅ Totale prodotti venduti ultimi 6 mesi: ${allSoldProductIds.size}\n`);
  return allSoldProductIds;
}

/**
 * Per ogni prodotto non venduto, trova la data dell'ultima vendita (se esiste)
 */
async function getLastSaleDate(cookies, productId) {
  try {
    const saleLines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [
        [
          ['product_id', '=', productId],
          ['state', 'in', ['sale', 'done']]
        ]
      ],
      {
        fields: ['create_date'],
        limit: 1,
        order: 'create_date desc'
      }
    );

    if (saleLines && saleLines.length > 0) {
      return saleLines[0].create_date.split(' ')[0]; // Solo la data
    }

    return 'Mai venduto';
  } catch (error) {
    console.error(`   ⚠️ Errore recupero ultima vendita per prodotto ${productId}:`, error.message);
    return 'Errore';
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // 1. Autentica
    const cookies = await authenticateOdoo();

    // 2. Ottieni tutti i prodotti attivi
    const allProducts = await getAllActiveProducts(cookies);

    // 3. Ottieni i prodotti venduti negli ultimi 6 mesi
    const soldProductIds = await getSoldProductIds(cookies);

    // 4. Identifica i prodotti NON venduti
    console.log('🔍 STEP 4: Identificazione prodotti non venduti...\n');

    const unsoldProducts = allProducts.filter(product => {
      return !soldProductIds.has(product.id);
    });

    console.log('='.repeat(100));
    console.log('📊 RISULTATI ANALISI');
    console.log('='.repeat(100));
    console.log(`\n📦 Totale prodotti attivi:              ${allProducts.length}`);
    console.log(`✅ Prodotti venduti ultimi 6 mesi:      ${soldProductIds.size}`);
    console.log(`❌ Prodotti NON venduti ultimi 6 mesi:  ${unsoldProducts.length}`);
    console.log(`📊 Percentuale non venduti:             ${((unsoldProducts.length / allProducts.length) * 100).toFixed(2)}%`);

    // 5. Ottieni la data ultima vendita per i prodotti non venduti (campione)
    console.log('\n' + '='.repeat(100));
    console.log('🔍 RECUPERO DATE ULTIMA VENDITA (primi 50 prodotti)...');
    console.log('='.repeat(100) + '\n');

    const sampleSize = Math.min(50, unsoldProducts.length);
    for (let i = 0; i < sampleSize; i++) {
      const product = unsoldProducts[i];
      console.log(`[${i + 1}/${sampleSize}] Controllo prodotto: ${product.default_code || product.id} - ${product.name}`);
      product.lastSaleDate = await getLastSaleDate(cookies, product.id);
    }

    // 6. Mostra i risultati dettagliati
    console.log('\n' + '='.repeat(100));
    console.log('📋 LISTA PRODOTTI NON VENDUTI ULTIMI 6 MESI');
    console.log('='.repeat(100) + '\n');

    if (unsoldProducts.length === 0) {
      console.log('✅ Ottimo! Tutti i prodotti sono stati venduti negli ultimi 6 mesi!\n');
    } else {
      // Ordina per codice prodotto
      unsoldProducts.sort((a, b) => {
        const codeA = a.default_code || '';
        const codeB = b.default_code || '';
        return codeA.localeCompare(codeB);
      });

      console.log('┌────────┬──────────────────────┬───────────────────────────────────────────────────┬───────────────┬───────────────┬──────────────┐');
      console.log('│ N.     │ Codice Prodotto      │ Nome Prodotto                                     │ Categoria     │ Prezzo (CHF)  │ Ultima Vendita│');
      console.log('├────────┼──────────────────────┼───────────────────────────────────────────────────┼───────────────┼───────────────┼──────────────┤');

      unsoldProducts.forEach((product, index) => {
        const num = String(index + 1).padEnd(6);
        const code = (product.default_code || 'N/A').padEnd(20).substring(0, 20);
        const name = product.name.padEnd(51).substring(0, 51);
        const category = (product.categ_id ? product.categ_id[1] : 'N/A').padEnd(13).substring(0, 13);
        const price = String(product.list_price?.toFixed(2) || '0.00').padStart(13);
        const lastSale = (product.lastSaleDate || '-').padEnd(14).substring(0, 14);

        console.log(`│ ${num} │ ${code} │ ${name} │ ${category} │ ${price} │ ${lastSale}│`);
      });

      console.log('└────────┴──────────────────────┴───────────────────────────────────────────────────┴───────────────┴───────────────┴──────────────┘');

      // Esporta anche in formato CSV
      console.log('\n' + '='.repeat(100));
      console.log('💾 EXPORT CSV');
      console.log('='.repeat(100) + '\n');

      let csvContent = 'Numero,Codice Prodotto,Nome Prodotto,Categoria,Prezzo (CHF),Giacenza,Ultima Vendita\n';

      unsoldProducts.forEach((product, index) => {
        const code = product.default_code || 'N/A';
        const name = product.name.replace(/"/g, '""'); // Escape virgolette
        const category = product.categ_id ? product.categ_id[1].replace(/"/g, '""') : 'N/A';
        const price = product.list_price?.toFixed(2) || '0.00';
        const qty = product.qty_available || 0;
        const lastSale = product.lastSaleDate || '-';

        csvContent += `${index + 1},"${code}","${name}","${category}",${price},${qty},"${lastSale}"\n`;
      });

      // Salva CSV
      const fs = require('fs');
      const csvFilename = `prodotti-non-venduti-6-mesi-${new Date().toISOString().split('T')[0]}.csv`;
      fs.writeFileSync(csvFilename, csvContent, 'utf-8');
      console.log(`✅ File CSV salvato: ${csvFilename}\n`);

      // Statistiche aggiuntive
      console.log('='.repeat(100));
      console.log('📊 STATISTICHE AGGIUNTIVE');
      console.log('='.repeat(100) + '\n');

      // Raggruppa per categoria
      const byCategory = {};
      unsoldProducts.forEach(product => {
        const category = product.categ_id ? product.categ_id[1] : 'Senza categoria';
        if (!byCategory[category]) {
          byCategory[category] = [];
        }
        byCategory[category].push(product);
      });

      console.log('📦 Prodotti non venduti per categoria:\n');
      Object.entries(byCategory)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([category, products]) => {
          console.log(`   ${category}: ${products.length} prodotti`);
        });

      // Valore totale stock non venduto
      const totalStockValue = unsoldProducts.reduce((sum, product) => {
        return sum + ((product.qty_available || 0) * (product.list_price || 0));
      }, 0);

      console.log(`\n💰 Valore totale stock non venduto: CHF ${totalStockValue.toFixed(2)}`);

      // Prodotti con giacenza alta
      const highStockProducts = unsoldProducts.filter(p => (p.qty_available || 0) > 10);
      console.log(`⚠️  Prodotti non venduti con giacenza > 10: ${highStockProducts.length}`);
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ ANALISI COMPLETATA!');
    console.log('='.repeat(100) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(100));
    console.error('❌ ERRORE DURANTE L\'ANALISI');
    console.error('='.repeat(100));
    console.error('\n❌ Errore:', error.message);
    console.error('\n📋 Stack trace:');
    console.error(error.stack);
    console.error('\n' + '='.repeat(100) + '\n');
    process.exit(1);
  }
}

// Esegui l'analisi
main();
