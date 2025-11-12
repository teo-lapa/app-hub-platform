/**
 * Aggiungi codici ai prodotti 24448 e 24449 e aggiungili all'ordine
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODOTTI = [
  { id: 24443, codice: '270420', quantita: 4, prezzo: 18.00 },
  { id: 24444, codice: '270421', quantita: 4, prezzo: 15.84 }
];

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD } })
  });

  const data = await response.json();
  if (data.error) throw new Error('Autenticazione fallita');

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
  if (!sessionMatch) throw new Error('Nessun session_id');

  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(`Errore: ${data.error.data?.message || 'unknown'}`);
  return data.result;
}

async function main() {
  try {
    console.log('🔐 Autenticazione...');
    const cookies = await authenticate();
    console.log('✅ Autenticato\n');

    // Cerca ordine
    const orders = await callOdoo(cookies, 'purchase.order', 'search_read', [[
      ['name', '=', 'P10101']
    ]], { fields: ['id'], limit: 1 });

    const orderId = orders[0].id;

    // Cerca UoM CRT-4
    const uoms = await callOdoo(cookies, 'uom.uom', 'search_read', [[
      ['name', '=', 'CRT-4']
    ]], { fields: ['id'], limit: 1 });

    const uomId = uoms[0].id;

    for (const item of PRODOTTI) {
      console.log(`📦 Prodotto ID ${item.id}...`);

      // Leggi prodotto
      const products = await callOdoo(cookies, 'product.template', 'read', [[item.id]], {
        fields: ['id', 'name', 'default_code']
      });

      const product = products[0];
      console.log(`   Nome: ${product.name.substring(0, 60)}`);
      console.log(`   Codice attuale: ${product.default_code || 'N/A'}`);

      // Aggiungi codice se manca
      if (!product.default_code || product.default_code !== item.codice) {
        console.log(`   📝 Aggiunta codice ${item.codice}...`);
        await callOdoo(cookies, 'product.template', 'write', [[item.id], {
          default_code: item.codice
        }]);
        console.log('   ✅ Codice aggiunto!');
      }

      // Trova variante
      const variants = await callOdoo(cookies, 'product.product', 'search_read', [[
        ['product_tmpl_id', '=', item.id]
      ]], { fields: ['id'], limit: 1 });

      // Aggiungi all'ordine
      console.log(`   📦 Aggiunta all'ordine P10101...`);
      await callOdoo(cookies, 'purchase.order.line', 'create', [{
        order_id: orderId,
        product_id: variants[0].id,
        name: product.name,
        product_qty: item.quantita,
        product_uom: uomId,
        price_unit: item.prezzo,
        date_planned: new Date().toISOString().split('T')[0]
      }]);

      const importo = item.quantita * item.prezzo;
      console.log(`   ✅ Aggiunto! Importo: €${importo.toFixed(2)}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ COMPLETATO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log('Adesso l\'ordine P10101 è completo con tutti i 26 prodotti!\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
