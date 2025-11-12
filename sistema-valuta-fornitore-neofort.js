/**
 * Script per sistemare la valuta del fornitore GROMAS per NEOFORT
 * Deve essere EUR non CHF
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODUCT_ID = 23107; // NEOFORT RAPIDO

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

async function findEuroCurrency(cookies) {
  console.log('\n💶 Ricerca valuta EUR...');

  const currencies = await callOdoo(cookies, 'res.currency', 'search_read', [[
    ['name', '=', 'EUR']
  ]], {
    fields: ['id', 'name', 'symbol']
  });

  if (currencies.length === 0) {
    throw new Error('Valuta EUR non trovata!');
  }

  console.log('✅ Valuta EUR trovata:', currencies[0].name, currencies[0].symbol, `(ID: ${currencies[0].id})`);
  return currencies[0];
}

async function updateSupplierInfo(cookies, euroCurrency) {
  console.log('\n🔍 Ricerca informazioni fornitore per prodotto ID:', PRODUCT_ID);

  // Cerca tutte le righe di product.supplierinfo per questo prodotto
  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_id', '=', PRODUCT_ID]
  ]], {
    fields: ['id', 'partner_id', 'product_name', 'product_code', 'price', 'currency_id', 'min_qty']
  });

  if (supplierInfos.length === 0) {
    console.log('⚠️  Nessuna informazione fornitore trovata per questo prodotto');
    return;
  }

  console.log(`\n📋 Trovate ${supplierInfos.length} righe fornitore:`);

  for (const info of supplierInfos) {
    console.log('\n---');
    console.log('   ID:', info.id);
    console.log('   Fornitore:', info.partner_id ? info.partner_id[1] : 'N/A');
    console.log('   Nome prodotto:', info.product_name || 'N/A');
    console.log('   Codice:', info.product_code || 'N/A');
    console.log('   Prezzo:', info.price);
    console.log('   Valuta attuale:', info.currency_id ? info.currency_id[1] : 'N/A');
    console.log('   Quantità minima:', info.min_qty);

    // Se la valuta NON è EUR, aggiorna
    if (!info.currency_id || info.currency_id[0] !== euroCurrency.id) {
      console.log('   ⚠️  Valuta errata! Aggiornamento a EUR...');

      await callOdoo(cookies, 'product.supplierinfo', 'write', [[info.id], {
        currency_id: euroCurrency.id
      }]);

      console.log('   ✅ Valuta aggiornata a EUR!');
    } else {
      console.log('   ✅ Valuta già corretta (EUR)');
    }
  }

  // Rileggi per conferma
  console.log('\n📋 VERIFICA FINALE:');
  const updatedInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_id', '=', PRODUCT_ID]
  ]], {
    fields: ['id', 'partner_id', 'product_name', 'price', 'currency_id']
  });

  for (const info of updatedInfos) {
    console.log('\n---');
    console.log('   Fornitore:', info.partner_id[1]);
    console.log('   Prezzo:', info.price, info.currency_id[1], '✅');
  }
}

async function main() {
  try {
    const cookies = await authenticate();

    // Step 1: Trova valuta EUR
    const euroCurrency = await findEuroCurrency(cookies);

    // Step 2: Aggiorna informazioni fornitore
    await updateSupplierInfo(cookies, euroCurrency);

    console.log('\n🎉 TUTTO SISTEMATO!');
    console.log('\n✅ Tutte le righe fornitore hanno ora valuta EUR');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
