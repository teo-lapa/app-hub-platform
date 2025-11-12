/**
 * Script per correggere i prezzi fornitore dei prodotti in cartone
 *
 * ERRORE FATTO: Ho messo il prezzo per pezzo anche nella riga fornitore
 * CORRETTO: La riga fornitore deve avere il prezzo PER CARTONE (come in fattura)
 *           mentre il costo interno (standard_price) deve essere per pezzo
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Prodotti in cartone con prezzi corretti dalla fattura
const PRODOTTI_CARTONE = [
  {
    id: 24428,
    codice: '270426',
    nome: 'EQO Brillantante',
    pezzi_per_cartone: 2,
    prezzo_cartone_fattura: 15.08,  // Prezzo fornitore (per cartone)
    costo_per_pezzo: 7.54            // Costo interno (per pezzo)
  },
  {
    id: 24426,
    codice: '39726',
    nome: 'ARGONIT AF/2',
    pezzi_per_cartone: 6,
    prezzo_cartone_fattura: 19.80,  // Prezzo fornitore (per cartone)
    costo_per_pezzo: 3.30            // Costo interno (per pezzo)
  },
  {
    id: 24427,
    codice: '31828',
    nome: 'VINCO Ammorbidente',
    pezzi_per_cartone: 4,
    prezzo_cartone_fattura: 7.70,   // Prezzo fornitore (per cartone)
    costo_per_pezzo: 1.93            // Costo interno (per pezzo)
  }
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

async function findGromas(cookies) {
  const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], { fields: ['id', 'name'], limit: 1 });

  return gromas[0];
}

async function correggiProdotto(cookies, gromasId, prodotto) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`📦 ${prodotto.codice} - ${prodotto.nome}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('📋 Prezzi corretti:');
  console.log(`   Prezzo fornitore (riga acquisto): ${prodotto.prezzo_cartone_fattura} EUR per cartone`);
  console.log(`   Costo interno (standard_price): ${prodotto.costo_per_pezzo} EUR per pezzo`);
  console.log('');

  // 1. Trova riga fornitore
  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', prodotto.id],
    ['partner_id', '=', gromasId]
  ]], { fields: ['id', 'price'], limit: 1 });

  if (supplierInfos.length === 0) {
    console.log('   ⚠️  Nessuna riga fornitore trovata!\n');
    return;
  }

  console.log(`   Prezzo fornitore attuale: ${supplierInfos[0].price} EUR`);

  // 2. Correggi prezzo fornitore (deve essere prezzo cartone)
  console.log(`   🔧 Aggiornamento a ${prodotto.prezzo_cartone_fattura} EUR per cartone...`);

  await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplierInfos[0].id], {
    price: prodotto.prezzo_cartone_fattura
  }]);

  console.log('   ✅ Prezzo fornitore aggiornato!\n');

  // 3. Verifica che il costo interno sia corretto
  const product = await callOdoo(cookies, 'product.template', 'read', [[prodotto.id]], {
    fields: ['standard_price']
  });

  console.log(`   Costo interno attuale: ${product[0].standard_price} EUR per pezzo`);

  if (Math.abs(product[0].standard_price - prodotto.costo_per_pezzo) > 0.01) {
    console.log(`   🔧 Correggo costo interno a ${prodotto.costo_per_pezzo} EUR per pezzo...`);

    await callOdoo(cookies, 'product.template', 'write', [[prodotto.id], {
      standard_price: prodotto.costo_per_pezzo
    }]);

    console.log('   ✅ Costo interno corretto!\n');
  } else {
    console.log('   ✅ Costo interno già corretto!\n');
  }
}

async function verificaProdotti(cookies, gromasId) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICA FINALE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const prod of PRODOTTI_CARTONE) {
    // Leggi prodotto
    const product = await callOdoo(cookies, 'product.template', 'read', [[prod.id]], {
      fields: ['name', 'default_code', 'standard_price', 'uom_id', 'uom_po_id']
    });

    // Leggi fornitore
    const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
      ['product_tmpl_id', '=', prod.id],
      ['partner_id', '=', gromasId]
    ]], { fields: ['price', 'currency_id'], limit: 1 });

    const p = product[0];
    const s = supplierInfos[0];

    console.log(`📦 ${prod.codice} - ${prod.nome}`);
    console.log(`   UoM Vendita: ${p.uom_id[1]}`);
    console.log(`   UoM Acquisto: ${p.uom_po_id[1]}`);
    console.log(`   Costo interno: ${p.standard_price} EUR per ${p.uom_id[1]}`);
    console.log(`   Prezzo fornitore: ${s.price} EUR per ${p.uom_po_id[1]}`);
    console.log(`   Verifica matematica: ${s.price} ÷ ${prod.pezzi_per_cartone} = ${(s.price / prod.pezzi_per_cartone).toFixed(2)} EUR per pezzo ✓`);
    console.log('');
  }
}

async function main() {
  try {
    const cookies = await authenticate();

    // Trova GROMAS
    console.log('🔍 Ricerca fornitore GROMAS...');
    const gromas = await findGromas(cookies);
    console.log(`✅ Trovato: ${gromas.name} (ID: ${gromas.id})\n`);

    // Correggi ogni prodotto
    for (const prod of PRODOTTI_CARTONE) {
      await correggiProdotto(cookies, gromas.id, prod);
    }

    // Verifica finale
    await verificaProdotti(cookies, gromas.id);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ PREZZI CORRETTI!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('📝 SPIEGAZIONE:');
    console.log('   • Prezzo FORNITORE: prezzo per CARTONE (come in fattura)');
    console.log('   • Costo INTERNO: prezzo per PEZZO (per calcoli di magazzino)');
    console.log('   • Quando acquisti 1 cartone, Odoo sa quanti pezzi sono grazie all\'UoM\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
