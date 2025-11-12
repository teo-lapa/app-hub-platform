/**
 * Aggiungi i 2 prodotti mancanti all'ordine P10101
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODOTTI_MANCANTI = [
  { codice: '270420', quantita: 4, uom: 'CRT-4', prezzo: 18.00 },
  { codice: '270421', quantita: 4, uom: 'CRT-4', prezzo: 15.84 }
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
    console.log(`✅ Ordine P10101 trovato (ID: ${orderId})\n`);

    // Cerca UoM CRT-4
    const uoms = await callOdoo(cookies, 'uom.uom', 'search_read', [[
      ['name', '=', 'CRT-4']
    ]], { fields: ['id'], limit: 1 });

    if (uoms.length === 0) {
      console.log('❌ UoM CRT-4 non trovato!');
      return;
    }

    const uomId = uoms[0].id;

    for (const item of PRODOTTI_MANCANTI) {
      console.log(`🔎 Ricerca prodotto ${item.codice}...`);

      // Cerca per nome invece che per codice
      let products = [];

      if (item.codice === '270420') {
        products = await callOdoo(cookies, 'product.template', 'search_read', [[
          ['name', 'ilike', 'EQO PIATTI'],
          ['name', 'ilike', 'TAN'],
          ['name', 'ilike', '5']
        ]], { fields: ['id', 'name', 'default_code'], limit: 5 });
      } else if (item.codice === '270421') {
        products = await callOdoo(cookies, 'product.template', 'search_read', [[
          ['name', 'ilike', 'EQO PAVIMENTI'],
          ['name', 'ilike', 'ARANCIA']
        ]], { fields: ['id', 'name', 'default_code'], limit: 5 });
      }

      console.log(`   Trovati ${products.length} prodotti:`);
      products.forEach(p => {
        console.log(`      ID ${p.id}: ${p.name.substring(0, 60)} | Codice: ${p.default_code || 'N/A'}`);
      });

      if (products.length === 0) {
        console.log(`   ❌ Prodotto non trovato!\n`);
        continue;
      }

      // Prendi il primo
      const product = products[0];

      // Se non ha codice, aggiungilo
      if (!product.default_code) {
        console.log(`   📝 Aggiunta codice ${item.codice}...`);
        await callOdoo(cookies, 'product.template', 'write', [[product.id], {
          default_code: item.codice
        }]);
      }

      // Trova variante
      const variants = await callOdoo(cookies, 'product.product', 'search_read', [[
        ['product_tmpl_id', '=', product.id]
      ]], { fields: ['id'], limit: 1 });

      if (variants.length === 0) {
        console.log(`   ❌ Variante non trovata!\n`);
        continue;
      }

      // Aggiungi all'ordine
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

    console.log('✅ COMPLETATO!\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
