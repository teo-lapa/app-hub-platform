/**
 * VERIFICA TAG "PRE-ORDINE" ASSEGNATI
 *
 * Questo script verifica quanti prodotti hanno il tag PRE-ORDINE in Odoo
 */

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const TAG_NAME = 'PRE-ORDINE';

console.log('\n' + '='.repeat(100));
console.log('🔍 VERIFICA TAG "PRE-ORDINE" IN ODOO');
console.log('='.repeat(100) + '\n');

/**
 * Autentica con Odoo
 */
async function authenticateOdoo() {
  console.log('🔐 Autenticazione con Odoo...');

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

  console.log(`✅ Autenticato! UID: ${data.result.uid}\n`);
  return `session_id=${sessionMatch[1]}`;
}

/**
 * Chiama un metodo Odoo
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
 * Main function
 */
async function main() {
  try {
    // 1. Autentica
    const cookies = await authenticateOdoo();

    // 2. Trova il tag PRE-ORDINE
    console.log(`🔍 Ricerca tag "${TAG_NAME}"...`);
    const tags = await callOdoo(
      cookies,
      'product.tag',
      'search_read',
      [[['name', '=', TAG_NAME]]],
      { fields: ['id', 'name', 'color'] }
    );

    if (!tags || tags.length === 0) {
      console.log(`❌ Tag "${TAG_NAME}" non trovato in Odoo!`);
      return;
    }

    const tagId = tags[0].id;
    console.log(`✅ Tag trovato: ID ${tagId}\n`);

    // 3. Conta prodotti con questo tag
    console.log('📊 Conteggio prodotti con tag PRE-ORDINE...');
    const count = await callOdoo(
      cookies,
      'product.product',
      'search_count',
      [[['product_tag_ids', 'in', [tagId]]]]
    );

    console.log(`✅ Prodotti con tag PRE-ORDINE: ${count}\n`);

    // 4. Mostra alcuni esempi di prodotti taggati
    console.log('📋 Esempi di prodotti taggati (primi 20):\n');
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [[['product_tag_ids', 'in', [tagId]]]],
      {
        fields: ['id', 'name', 'default_code', 'list_price', 'qty_available', 'product_tag_ids'],
        limit: 20
      }
    );

    products.forEach((product, index) => {
      console.log(`${index + 1}. [${product.default_code || 'N/A'}] ${product.name}`);
      console.log(`   - ID: ${product.id}`);
      console.log(`   - Prezzo: CHF ${product.list_price?.toFixed(2) || '0.00'}`);
      console.log(`   - Giacenza: ${product.qty_available || 0}`);
      console.log(`   - Tags: ${product.product_tag_ids.length} tag(s)\n`);
    });

    console.log('='.repeat(100));
    console.log('✅ VERIFICA COMPLETATA!');
    console.log('='.repeat(100));
    console.log(`\n📊 RIEPILOGO:`);
    console.log(`   - Tag ID: ${tagId}`);
    console.log(`   - Prodotti taggati: ${count}`);
    console.log(`\n🔗 Verifica manualmente su Odoo:`);
    console.log(`   ${ODOO_URL}/web#action=stock.product_product_action_sellable_all_states&model=product.product&view_type=kanban`);
    console.log(`   Filtra per tag: "${TAG_NAME}"\n`);

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
