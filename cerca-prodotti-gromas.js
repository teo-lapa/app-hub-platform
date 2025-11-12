/**
 * Script per cercare TUTTI i prodotti GROMAS nel sistema
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// I 5 codici che stiamo cercando
const CODICI_CERCATI = ['26425', '09731', '270420', '270421', '270422'];

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
  if (data.error) throw new Error(`Errore ${model}.${method}: ${data.error.data?.message || 'unknown'}`);
  return data.result;
}

async function main() {
  try {
    console.log('🔐 Autenticazione...');
    const cookies = await authenticate();
    console.log('✅ Autenticato\n');

    // Trova GROMAS
    const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
      ['name', 'ilike', 'GROMAS']
    ]], { fields: ['id', 'name'], limit: 1 });

    if (gromas.length === 0) {
      console.log('❌ GROMAS non trovato!');
      return;
    }

    console.log(`✅ Fornitore: ${gromas[0].name} (ID: ${gromas[0].id})\n`);

    // Cerca tutti i prodotti GROMAS (attivi E inattivi)
    console.log('🔍 Ricerca TUTTI i prodotti GROMAS...\n');

    for (const active of [true, false]) {
      console.log(`═══════════════════════════════════════════════════════════════════`);
      console.log(`📦 PRODOTTI ${active ? 'ATTIVI' : 'INATTIVI'}`);
      console.log(`═══════════════════════════════════════════════════════════════════\n`);

      const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
        ['partner_id', '=', gromas[0].id]
      ]], { fields: ['product_tmpl_id', 'product_code'], limit: 100 });

      console.log(`Trovate ${supplierInfos.length} righe fornitore\n`);

      // Per ogni riga fornitore, verifica se il prodotto è attivo/inattivo
      for (const info of supplierInfos) {
        const products = await callOdoo(cookies, 'product.template', 'search_read', [[
          ['id', '=', info.product_tmpl_id[0]],
          ['active', '=', active]
        ]], { fields: ['id', 'name', 'default_code'], limit: 1 });

        if (products.length > 0) {
          const p = products[0];
          const isCercato = CODICI_CERCATI.includes(p.default_code);
          const marker = isCercato ? '⭐⭐⭐' : '';

          console.log(`${marker} ID: ${p.id} | Codice: ${p.default_code || 'N/A'} | Nome: ${p.name.substring(0, 60)}`);
        }
      }
      console.log('');
    }

    // Cerca anche per codici specifici (senza filtro fornitore)
    console.log(`═══════════════════════════════════════════════════════════════════`);
    console.log(`🔍 RICERCA DIRETTA PER CODICI (TUTTI I PRODOTTI, NON SOLO GROMAS)`);
    console.log(`═══════════════════════════════════════════════════════════════════\n`);

    for (const codice of CODICI_CERCATI) {
      console.log(`\n🔎 Codice: ${codice}`);

      for (const active of [true, false]) {
        const products = await callOdoo(cookies, 'product.template', 'search_read', [[
          ['default_code', '=', codice],
          ['active', '=', active]
        ]], { fields: ['id', 'name', 'default_code'], limit: 10 });

        if (products.length > 0) {
          console.log(`   ${active ? 'ATTIVI' : 'INATTIVI'}:`);
          products.forEach(p => {
            console.log(`      ID: ${p.id} | ${p.name}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
