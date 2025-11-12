/**
 * Script per trovare e sistemare le righe fornitore GROMAS
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

  console.log('✅ Valuta EUR trovata:', currencies[0].name, `(ID: ${currencies[0].id})`);
  return currencies[0];
}

async function exploreProduct(cookies, euroCurrency) {
  console.log('\n🔍 Lettura completa prodotto...');

  // Leggi product.product
  const product = await callOdoo(cookies, 'product.product', 'read', [[PRODUCT_ID]], {
    fields: ['id', 'name', 'product_tmpl_id', 'seller_ids']
  });

  console.log('\n📦 Product.product:');
  console.log('   ID:', product[0].id);
  console.log('   Nome:', product[0].name);
  console.log('   Template ID:', product[0].product_tmpl_id);
  console.log('   Seller IDs:', product[0].seller_ids);

  const templateId = product[0].product_tmpl_id[0];

  // Leggi product.template
  const template = await callOdoo(cookies, 'product.template', 'read', [[templateId]], {
    fields: ['id', 'name', 'seller_ids']
  });

  console.log('\n📋 Product.template:');
  console.log('   ID:', template[0].id);
  console.log('   Nome:', template[0].name);
  console.log('   Seller IDs:', template[0].seller_ids);

  // Se ci sono seller_ids, leggili
  if (template[0].seller_ids && template[0].seller_ids.length > 0) {
    console.log('\n🏢 Righe fornitore trovate:', template[0].seller_ids.length);

    const sellers = await callOdoo(cookies, 'product.supplierinfo', 'read', [template[0].seller_ids], {
      fields: ['id', 'partner_id', 'product_name', 'product_code', 'price', 'currency_id', 'min_qty', 'product_id', 'product_tmpl_id']
    });

    for (const seller of sellers) {
      console.log('\n---');
      console.log('   Supplierinfo ID:', seller.id);
      console.log('   Fornitore:', seller.partner_id ? seller.partner_id[1] : 'N/A');
      console.log('   Nome prodotto:', seller.product_name || 'N/A');
      console.log('   Codice:', seller.product_code || 'N/A');
      console.log('   Prezzo:', seller.price);
      console.log('   Valuta:', seller.currency_id ? seller.currency_id[1] : 'N/A', `(ID: ${seller.currency_id ? seller.currency_id[0] : 'N/A'})`);
      console.log('   Product ID:', seller.product_id || 'Template-level');
      console.log('   Product Tmpl ID:', seller.product_tmpl_id);

      // Aggiorna a EUR se necessario
      if (seller.currency_id && seller.currency_id[0] !== euroCurrency.id) {
        console.log('   🔄 Aggiornamento valuta a EUR...');

        await callOdoo(cookies, 'product.supplierinfo', 'write', [[seller.id], {
          currency_id: euroCurrency.id
        }]);

        console.log('   ✅ Valuta aggiornata!');
      } else {
        console.log('   ✅ Valuta già EUR');
      }
    }

    // Verifica finale
    console.log('\n✅ VERIFICA FINALE:');
    const updatedSellers = await callOdoo(cookies, 'product.supplierinfo', 'read', [template[0].seller_ids], {
      fields: ['partner_id', 'product_code', 'price', 'currency_id']
    });

    for (const seller of updatedSellers) {
      console.log(`   ${seller.partner_id[1]} - Codice: ${seller.product_code} - Prezzo: ${seller.price} ${seller.currency_id[1]}`);
    }
  } else {
    console.log('\n⚠️  Nessuna riga fornitore trovata');
  }
}

async function main() {
  try {
    const cookies = await authenticate();
    const euroCurrency = await findEuroCurrency(cookies);
    await exploreProduct(cookies, euroCurrency);

    console.log('\n🎉 FATTO!');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
