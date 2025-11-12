/**
 * Script per verificare e fixare la categoria UoM di CRT
 * Deve essere nella stessa categoria di PZ
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD
      }
    })
  });

  const data = await response.json();
  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  const cookies = await authenticate();

  console.log('🔍 Verifica UoM...\n');

  // Trova PZ
  const uomPZ = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    '|', ['name', '=', 'PZ'], ['name', '=', 'Unità']
  ]], { fields: ['id', 'name', 'category_id'], limit: 1 });

  console.log('📏 UoM PZ:');
  console.log('   ID:', uomPZ[0].id);
  console.log('   Nome:', uomPZ[0].name);
  console.log('   Categoria:', uomPZ[0].category_id[1], `(ID: ${uomPZ[0].category_id[0]})\n`);

  // Trova CRT
  const uomCRT = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CRT']
  ]], { fields: ['id', 'name', 'category_id'], limit: 1 });

  console.log('📦 UoM CRT:');
  console.log('   ID:', uomCRT[0].id);
  console.log('   Nome:', uomCRT[0].name);
  console.log('   Categoria:', uomCRT[0].category_id[1], `(ID: ${uomCRT[0].category_id[0]})\n`);

  // Verifica se sono nella stessa categoria
  if (uomPZ[0].category_id[0] !== uomCRT[0].category_id[0]) {
    console.log('❌ PROBLEMA: PZ e CRT sono in categorie diverse!');
    console.log(`   PZ categoria: ${uomPZ[0].category_id[1]}`);
    console.log(`   CRT categoria: ${uomCRT[0].category_id[1]}\n`);

    console.log('🔧 Correggo: sposto CRT nella categoria di PZ...\n');

    await callOdoo(cookies, 'uom.uom', 'write', [[uomCRT[0].id], {
      category_id: uomPZ[0].category_id[0]
    }]);

    console.log('✅ CRT spostato nella categoria corretta!\n');

    // Verifica
    const updated = await callOdoo(cookies, 'uom.uom', 'read', [[uomCRT[0].id]], {
      fields: ['id', 'name', 'category_id']
    });

    console.log('📦 UoM CRT aggiornato:');
    console.log('   Categoria:', updated[0].category_id[1], `(ID: ${updated[0].category_id[0]})`);
    console.log('\n✅ Ora PZ e CRT sono nella stessa categoria!');
  } else {
    console.log('✅ PZ e CRT sono già nella stessa categoria!');
  }
}

main().catch(err => console.error('❌ ERRORE:', err.message));
