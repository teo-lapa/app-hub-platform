/**
 * Cerca i prodotti 270420 e 270421
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

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

    const codici = ['270420', '270421'];

    for (const codice of codici) {
      console.log(`🔎 Codice: ${codice}`);

      // Cerca TUTTI (attivi e inattivi)
      const products = await callOdoo(cookies, 'product.template', 'search_read', [[
        ['default_code', '=', codice]
      ]], {
        fields: ['id', 'name', 'active', 'uom_id', 'uom_po_id'],
        context: { active_test: false },
        limit: 10
      });

      console.log(`   Trovati: ${products.length}`);
      products.forEach(p => {
        const status = p.active ? '✅ ATTIVO' : '❌ INATTIVO';
        console.log(`      ${status} - ID ${p.id}: ${p.name.substring(0, 50)}`);
        console.log(`         UoM V: ${p.uom_id[1]} | UoM A: ${p.uom_po_id[1]}`);
      });

      console.log('');
    }

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
