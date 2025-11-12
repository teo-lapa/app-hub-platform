/**
 * Script per rinominare UoM da CARTONE a CRT
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

async function authenticate() {
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
        login: ODOO_LOGIN,
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

  console.log('✅ Autenticazione riuscita!');
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
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function renameUom(cookies) {
  console.log('\n🔍 Ricerca UoM CARTONE...');

  // Cerca UoM CARTONE
  const uoms = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CARTONE']
  ]], {
    fields: ['id', 'name', 'category_id', 'factor_inv']
  });

  if (uoms.length === 0) {
    throw new Error('UoM CARTONE non trovato');
  }

  const cartoneUom = uoms[0];
  console.log('✅ UoM trovato:');
  console.log('   ID:', cartoneUom.id);
  console.log('   Nome attuale:', cartoneUom.name);
  console.log('   Factor:', cartoneUom.factor_inv);

  // Rinomina a CRT
  console.log('\n🔄 Rinomino a "CRT"...');

  await callOdoo(cookies, 'uom.uom', 'write', [[cartoneUom.id], {
    name: 'CRT'
  }]);

  console.log('✅ UoM rinominato!');

  // Verifica
  const updatedUom = await callOdoo(cookies, 'uom.uom', 'read', [[cartoneUom.id]], {
    fields: ['id', 'name', 'factor_inv']
  });

  console.log('\n📋 Configurazione finale:');
  console.log('   ID:', updatedUom[0].id);
  console.log('   Nome:', updatedUom[0].name);
  console.log('   1 CRT =', updatedUom[0].factor_inv, 'PZ');

  return updatedUom[0];
}

async function main() {
  try {
    const cookies = await authenticate();
    await renameUom(cookies);

    console.log('\n🎉 FATTO!');
    console.log('\nOra l\'unità di misura si chiama "CRT" invece di "CARTONE"');
    console.log('Più corto e professionale! 📦');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
