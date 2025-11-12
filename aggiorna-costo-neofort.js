/**
 * Script per aggiornare il costo del prodotto NEOFORT
 * Costo cartone: 17.52€
 * Costo per pezzo: 17.52 / 6 = 2.92€
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODUCT_ID = 23107; // NEOFORT RAPIDO
const COSTO_CARTONE = 17.52;
const PEZZI_PER_CARTONE = 6;
const COSTO_PER_PEZZO = COSTO_CARTONE / PEZZI_PER_CARTONE; // 2.92€

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

async function updateProductCost(cookies) {
  console.log('\n💰 Aggiornamento costo prodotto NEOFORT...');
  console.log('   Costo cartone (6 pz):', COSTO_CARTONE.toFixed(2), '€');
  console.log('   Costo per pezzo:', COSTO_PER_PEZZO.toFixed(2), '€');

  // Leggi prodotto attuale
  const product = await callOdoo(cookies, 'product.product', 'read', [[PRODUCT_ID]], {
    fields: ['name', 'standard_price', 'list_price', 'uom_id', 'uom_po_id', 'currency_id']
  });

  console.log('\n📋 CONFIGURAZIONE ATTUALE:');
  console.log('   Nome:', product[0].name);
  console.log('   Costo (standard_price):', product[0].standard_price, '€');
  console.log('   Prezzo vendita (list_price):', product[0].list_price, '€');
  console.log('   UoM vendita:', product[0].uom_id[1]);
  console.log('   UoM acquisto:', product[0].uom_po_id[1]);
  console.log('   Valuta:', product[0].currency_id ? product[0].currency_id[1] : 'Default');

  // Aggiorna costo
  await callOdoo(cookies, 'product.product', 'write', [[PRODUCT_ID], {
    standard_price: COSTO_PER_PEZZO
  }]);

  console.log('\n✅ Costo aggiornato!');

  // Rileggi per conferma
  const updatedProduct = await callOdoo(cookies, 'product.product', 'read', [[PRODUCT_ID]], {
    fields: ['name', 'standard_price', 'list_price', 'uom_id', 'uom_po_id']
  });

  console.log('\n📋 CONFIGURAZIONE NUOVA:');
  console.log('   Nome:', updatedProduct[0].name);
  console.log('   Costo (standard_price):', updatedProduct[0].standard_price, '€ per pezzo ✅');
  console.log('   Prezzo vendita (list_price):', updatedProduct[0].list_price, '€');
  console.log('   UoM vendita:', updatedProduct[0].uom_id[1]);
  console.log('   UoM acquisto:', updatedProduct[0].uom_po_id[1]);

  console.log('\n💡 Come funziona ora:');
  console.log('   📦 Acquisti 1 CARTONE dal fornitore a 17.52€');
  console.log('   → Odoo registra +6 PZ in giacenza');
  console.log('   → Costo unitario: 2.92€/pezzo');
  console.log('   💰 Vendi 1 PZ al cliente');
  console.log('   → Costo: 2.92€');
  console.log('   → Prezzo: 35.04€ (o quello convertito in CHF)');
  console.log('   → Margine: 32.12€ per pezzo');

  return updatedProduct[0];
}

async function main() {
  try {
    const cookies = await authenticate();
    await updateProductCost(cookies);

    console.log('\n🎉 TUTTO FATTO!');
    console.log('\n✅ Configurazione completa:');
    console.log('   • UoM vendita: PZ (pezzo/bottiglia)');
    console.log('   • UoM acquisto: CARTONE (6 pezzi)');
    console.log('   • Costo: 2.92€ per pezzo');
    console.log('   • Prezzo: 35.04€ per pezzo (Odoo convertirà in CHF)');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
