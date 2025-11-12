/**
 * Script per aggiungere i codici prodotto ai 5 nuovi prodotti
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODOTTI = [
  { id: 24446, codice: '26425', nome: 'GUANTI NERI M NITRILE REFLEXX 100 PZ' },
  { id: 24447, codice: '09731', nome: 'PULIVAT CONF 750 ML X 6 PZ' },
  { id: 24448, codice: '270420', nome: 'EQO PIATTI A MANO TAN KG 5X4 INTER' },
  { id: 24449, codice: '270421', nome: 'EQO PAVIMENTI ARANCIA-LIM KG 5X4 INTER' },
  { id: 24450, codice: '270422', nome: 'EQO SGRASSATORE LIM LT 0.75X6+6SP INTER' }
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
  if (data.error) throw new Error(`Errore ${model}.${method}: ${data.error.data?.message || 'unknown'}`);
  return data.result;
}

async function main() {
  try {
    console.log('🔐 Autenticazione...');
    const cookies = await authenticate();
    console.log('✅ Autenticato\n');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🔧 AGGIUNTA CODICI PRODOTTO');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    for (const prod of PRODOTTI) {
      console.log(`📦 ID ${prod.id} - ${prod.nome.substring(0, 40)}...`);
      console.log(`   Codice da aggiungere: ${prod.codice}`);

      await callOdoo(cookies, 'product.template', 'write', [[prod.id], {
        default_code: prod.codice
      }]);

      console.log('   ✅ Codice aggiunto!\n');
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ COMPLETATO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('🔍 Verifica:');
    for (const prod of PRODOTTI) {
      const products = await callOdoo(cookies, 'product.template', 'read', [[prod.id]], {
        fields: ['default_code']
      });
      console.log(`   ID ${prod.id}: Codice = ${products[0].default_code || 'N/A'}`);
    }

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
