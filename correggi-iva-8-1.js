/**
 * Script per correggere l'IVA cliente a 8.1% per tutti i 6 prodotti GROMAS
 * IVA corretta: 8.1% (non 2.6%)
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// I 6 prodotti da aggiornare
const PRODOTTI = [
  { id: 24428, codice: '270426', nome: 'EQO Brillantante' },
  { id: 24426, codice: '39726', nome: 'ARGONIT AF/2' },
  { id: 24427, codice: '31828', nome: 'VINCO Ammorbidente' },
  { id: 24429, codice: '411024', nome: 'POLIUNTO X2' },
  { id: 24425, codice: '26424', nome: 'Guanti L' },
  { id: 24430, codice: '26426', nome: 'Guanti S' }
];

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

  console.log('✅ Autenticazione riuscita!\n');
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

async function findTax81(cookies) {
  console.log('🔍 Ricerca IVA cliente 8.1%...');

  // Cerca l'imposta con aliquota 8.1%
  const taxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['amount', '=', 8.1],
    ['type_tax_use', '=', 'sale']
  ]], { fields: ['id', 'name', 'amount'], limit: 5 });

  if (taxes.length === 0) {
    console.log('⚠️  IVA 8.1% non trovata. Cerco imposte disponibili...');

    // Mostra tutte le imposte vendita disponibili
    const allTaxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
      ['type_tax_use', '=', 'sale']
    ]], { fields: ['id', 'name', 'amount'], limit: 30 });

    console.log('\n📋 Imposte vendita disponibili:');
    allTaxes.forEach(tax => {
      console.log(`   • ${tax.name} (${tax.amount}%) - ID: ${tax.id}`);
    });

    throw new Error('IVA 8.1% non trovata nel sistema');
  }

  console.log('✅ IVA trovata:', taxes[0].name, `(${taxes[0].amount}%)\n`);
  return taxes[0];
}

async function aggiornaProdotti(cookies, taxId) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔄 AGGIORNAMENTO IVA CLIENTE A 8.1%');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const prod of PRODOTTI) {
    console.log(`📦 ${prod.codice} - ${prod.nome}`);

    // Leggi imposte attuali
    const product = await callOdoo(cookies, 'product.template', 'read', [[prod.id]], {
      fields: ['taxes_id']
    });

    const currentTaxes = product[0].taxes_id || [];
    console.log(`   Imposte attuali: ${currentTaxes.length > 0 ? currentTaxes.join(', ') : 'nessuna'}`);

    // Aggiorna imposte cliente a 8.1%
    await callOdoo(cookies, 'product.template', 'write', [[prod.id], {
      taxes_id: [[6, 0, [taxId]]]  // Sostituisci con solo l'IVA 8.1%
    }]);

    console.log(`   ✅ IVA aggiornata a 8.1%\n`);
  }
}

async function verificaProdotti(cookies) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICA FINALE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const prod of PRODOTTI) {
    const product = await callOdoo(cookies, 'product.template', 'read', [[prod.id]], {
      fields: ['name', 'default_code', 'taxes_id', 'list_price', 'standard_price']
    });

    const p = product[0];

    // Leggi dettagli imposte
    if (p.taxes_id && p.taxes_id.length > 0) {
      const taxes = await callOdoo(cookies, 'account.tax', 'read', [p.taxes_id], {
        fields: ['name', 'amount']
      });

      console.log(`📦 ${prod.codice} - ${prod.nome}`);
      console.log(`   Prezzo vendita: CHF ${p.list_price}`);
      console.log(`   Costo: CHF ${p.standard_price}`);
      console.log(`   IVA cliente:`);
      taxes.forEach(tax => {
        console.log(`      • ${tax.name} (${tax.amount}%)`);
      });
      console.log('');
    } else {
      console.log(`📦 ${prod.codice} - ${prod.nome}`);
      console.log(`   ⚠️  Nessuna IVA impostata\n`);
    }
  }
}

async function main() {
  try {
    const cookies = await authenticate();

    // 1. Trova IVA 8.1%
    const tax81 = await findTax81(cookies);

    // 2. Aggiorna tutti i prodotti
    await aggiornaProdotti(cookies, tax81.id);

    // 3. Verifica
    await verificaProdotti(cookies);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ IVA AGGIORNATA CON SUCCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
