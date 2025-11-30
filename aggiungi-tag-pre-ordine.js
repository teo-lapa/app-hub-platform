/**
 * ASSEGNAZIONE TAG "PRE-ORDINE" A PRODOTTI NON VENDUTI
 *
 * Questo script:
 * 1. Legge il CSV dei prodotti non venduti da 6+ mesi
 * 2. Si connette a Odoo
 * 3. Verifica/crea il tag "PRE-ORDINE" (product.tag)
 * 4. Cerca ogni prodotto in Odoo per ottenere il product.id
 * 5. Assegna il tag a tutti i prodotti in batch
 * 6. Mostra report finale con risultati
 */

const fs = require('fs');

// Configurazione Odoo (da .env.local)
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Nome file CSV
const CSV_FILE = 'prodotti-non-venduti-6-mesi-2025-11-09.csv';
const TAG_NAME = 'PRE-ORDINE';

console.log('\n' + '='.repeat(100));
console.log('🏷️  ASSEGNAZIONE TAG "PRE-ORDINE" A PRODOTTI NON VENDUTI');
console.log('='.repeat(100));
console.log(`📁 File CSV: ${CSV_FILE}`);
console.log(`🔗 Odoo URL: ${ODOO_URL}`);
console.log(`🏷️  Tag: ${TAG_NAME}`);
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
 * Legge il CSV e estrae i prodotti
 */
function readProductsFromCSV() {
  console.log('📖 STEP 2: Lettura CSV prodotti non venduti...');

  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.split('\n').slice(1); // Salta header

  const products = [];

  lines.forEach((line, index) => {
    if (!line.trim()) return; // Salta righe vuote

    // Parse CSV: numero,"codice","nome","categoria",prezzo,giacenza,"ultima_vendita"
    // Usa regex per estrarre i campi correttamente gestendo virgolette
    const regex = /(?:^|,)("(?:[^"]|"")*"|[^,]*)/g;
    const fields = [];
    let match;

    while ((match = regex.exec(line)) !== null) {
      let field = match[1];
      if (field && field.startsWith('"') && field.endsWith('"')) {
        field = field.slice(1, -1).replace(/""/g, '"');
      }
      fields.push(field ? field.trim() : '');
    }

    // Estrai i campi
    if (fields.length < 3) return;

    const numero = fields[0];
    const codice = fields[1];
    const nome = fields[2];

    // Salta prodotti senza nome valido
    if (!nome || nome === 'N/A') return;

    products.push({
      numero: parseInt(numero) || index + 1,
      codice: codice && codice !== 'N/A' ? codice : null,
      nome: nome
    });
  });

  console.log(`✅ Letti ${products.length} prodotti dal CSV\n`);
  return products;
}

/**
 * Verifica se esiste il tag PRE-ORDINE, altrimenti lo crea
 */
async function ensurePreOrdineTag(cookies) {
  console.log(`🔍 STEP 3: Verifica esistenza tag "${TAG_NAME}"...`);

  // Cerca il tag
  const tags = await callOdoo(
    cookies,
    'product.tag',
    'search_read',
    [[['name', '=', TAG_NAME]]],
    { fields: ['id', 'name', 'color'] }
  );

  if (tags && tags.length > 0) {
    console.log(`✅ Tag "${TAG_NAME}" già esistente (ID: ${tags[0].id})\n`);
    return tags[0].id;
  }

  // Crea il tag
  console.log(`➕ Tag "${TAG_NAME}" non trovato, creazione in corso...`);

  const tagId = await callOdoo(
    cookies,
    'product.tag',
    'create',
    [{
      name: TAG_NAME,
      color: 5 // Colore rosso/arancione per evidenziare
    }]
  );

  console.log(`✅ Tag "${TAG_NAME}" creato con successo (ID: ${tagId})\n`);
  return tagId;
}

/**
 * Cerca un prodotto in Odoo per nome (e opzionalmente codice)
 */
async function findProductInOdoo(cookies, product) {
  try {
    // Prova prima con codice se disponibile
    if (product.codice) {
      const byCode = await callOdoo(
        cookies,
        'product.product',
        'search_read',
        [[['default_code', '=', product.codice]]],
        { fields: ['id', 'name', 'default_code'], limit: 1 }
      );

      if (byCode && byCode.length > 0) {
        return byCode[0].id;
      }
    }

    // Fallback: cerca per nome esatto
    const byName = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [[['name', '=', product.nome]]],
      { fields: ['id', 'name', 'default_code'], limit: 1 }
    );

    if (byName && byName.length > 0) {
      return byName[0].id;
    }

    return null;
  } catch (error) {
    console.error(`   ⚠️ Errore ricerca prodotto "${product.nome}":`, error.message);
    return null;
  }
}

/**
 * Assegna il tag PRE-ORDINE a un batch di prodotti
 */
async function assignTagToProducts(cookies, productIds, tagId) {
  if (productIds.length === 0) return;

  try {
    // Usa write() con operazione (4, tagId) per AGGIUNGERE il tag senza rimuovere altri tag
    // Sintassi Odoo per relazioni Many2many:
    // (4, id) = aggiungi link a record esistente
    // (3, id) = rimuovi link
    // (6, 0, [ids]) = sostituisci tutti i link

    await callOdoo(
      cookies,
      'product.product',
      'write',
      [
        productIds,
        {
          product_tag_ids: [[4, tagId, 0]] // Aggiungi tag mantenendo gli esistenti
        }
      ]
    );

    return true;
  } catch (error) {
    console.error(`   ❌ Errore assegnazione tag batch:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();

  try {
    // 1. Autentica
    const cookies = await authenticateOdoo();

    // 2. Leggi CSV
    const csvProducts = readProductsFromCSV();

    if (csvProducts.length === 0) {
      console.log('⚠️  Nessun prodotto trovato nel CSV!');
      return;
    }

    // 3. Verifica/crea tag
    const tagId = await ensurePreOrdineTag(cookies);

    // 4. Cerca prodotti in Odoo e ottieni i product.id
    console.log('🔍 STEP 4: Ricerca prodotti in Odoo per ottenere product.id...\n');

    const foundProducts = [];
    const notFoundProducts = [];
    const batchSize = 50; // Mostra progress ogni 50 prodotti

    for (let i = 0; i < csvProducts.length; i++) {
      const product = csvProducts[i];

      // Mostra progress ogni batchSize prodotti
      if (i > 0 && i % batchSize === 0) {
        console.log(`   Processati ${i}/${csvProducts.length} prodotti... (${foundProducts.length} trovati, ${notFoundProducts.length} non trovati)`);
      }

      const productId = await findProductInOdoo(cookies, product);

      if (productId) {
        foundProducts.push({
          ...product,
          odooId: productId
        });
      } else {
        notFoundProducts.push(product);
      }
    }

    console.log(`\n✅ Ricerca completata:`);
    console.log(`   - Prodotti trovati in Odoo: ${foundProducts.length}`);
    console.log(`   - Prodotti NON trovati: ${notFoundProducts.length}\n`);

    // 5. Assegna tag in batch
    console.log('🏷️  STEP 5: Assegnazione tag PRE-ORDINE in batch...\n');

    const assignBatchSize = 100; // Assegna tag a 100 prodotti alla volta
    let totalAssigned = 0;
    let totalFailed = 0;

    for (let i = 0; i < foundProducts.length; i += assignBatchSize) {
      const batch = foundProducts.slice(i, i + assignBatchSize);
      const productIds = batch.map(p => p.odooId);

      console.log(`   Assegnazione batch ${Math.floor(i / assignBatchSize) + 1}/${Math.ceil(foundProducts.length / assignBatchSize)} (${productIds.length} prodotti)...`);

      const success = await assignTagToProducts(cookies, productIds, tagId);

      if (success) {
        totalAssigned += productIds.length;
        console.log(`   ✅ Batch completato (${productIds.length} prodotti taggati)`);
      } else {
        totalFailed += productIds.length;
        console.log(`   ❌ Batch fallito`);
      }
    }

    // 6. Report finale
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(100));
    console.log('📊 REPORT FINALE');
    console.log('='.repeat(100));
    console.log(`\n📁 File CSV:                              ${CSV_FILE}`);
    console.log(`📦 Prodotti totali nel CSV:               ${csvProducts.length}`);
    console.log(`✅ Prodotti trovati in Odoo:              ${foundProducts.length}`);
    console.log(`❌ Prodotti NON trovati in Odoo:          ${notFoundProducts.length}`);
    console.log(`🏷️  Tag "${TAG_NAME}" (ID: ${tagId})`);
    console.log(`✅ Prodotti taggati con successo:         ${totalAssigned}`);
    console.log(`❌ Prodotti falliti:                      ${totalFailed}`);
    console.log(`⏱️  Tempo totale:                          ${elapsed}s`);

    // 7. Salva report prodotti non trovati
    if (notFoundProducts.length > 0) {
      console.log('\n' + '='.repeat(100));
      console.log('⚠️  PRODOTTI NON TROVATI IN ODOO');
      console.log('='.repeat(100) + '\n');

      let reportContent = 'Numero,Codice,Nome\n';
      notFoundProducts.forEach(p => {
        const code = p.codice || 'N/A';
        const name = p.nome.replace(/"/g, '""');
        reportContent += `${p.numero},"${code}","${name}"\n`;
        console.log(`   ${p.numero}. ${code} - ${name}`);
      });

      const reportFilename = `prodotti-non-trovati-${new Date().toISOString().split('T')[0]}.csv`;
      fs.writeFileSync(reportFilename, reportContent, 'utf-8');
      console.log(`\n💾 Report salvato: ${reportFilename}`);
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ OPERAZIONE COMPLETATA!');
    console.log('='.repeat(100));
    console.log(`\n🔍 Verifica i risultati in Odoo:`);
    console.log(`   1. Vai su: ${ODOO_URL}`);
    console.log(`   2. Menu: Inventario > Prodotti`);
    console.log(`   3. Filtra per tag: "${TAG_NAME}"`);
    console.log(`   4. Dovresti vedere ${totalAssigned} prodotti taggati\n`);

  } catch (error) {
    console.error('\n' + '='.repeat(100));
    console.error('❌ ERRORE DURANTE L\'OPERAZIONE');
    console.error('='.repeat(100));
    console.error('\n❌ Errore:', error.message);
    console.error('\n📋 Stack trace:');
    console.error(error.stack);
    console.error('\n' + '='.repeat(100) + '\n');
    process.exit(1);
  }
}

// Esegui lo script
main();
