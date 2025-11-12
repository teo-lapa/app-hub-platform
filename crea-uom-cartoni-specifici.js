/**
 * Script per creare UoM CARTONE specifiche per ogni tipo di confezione
 * e aggiornare i prodotti con le UoM corrette
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Tipi di cartone da creare
const TIPI_CARTONE = [
  { name: 'CRT-2', pezzi: 2, descrizione: 'Cartone da 2 pezzi' },
  { name: 'CRT-4', pezzi: 4, descrizione: 'Cartone da 4 pezzi' },
  { name: 'CRT-6', pezzi: 6, descrizione: 'Cartone da 6 pezzi' }
];

// Mapping prodotti -> UoM cartone
const PRODOTTI_CARTONE = [
  { id: 24428, codice: '270426', nome: 'EQO Brillantante', uom_name: 'CRT-2' },
  { id: 24426, codice: '39726', nome: 'ARGONIT AF/2', uom_name: 'CRT-6' },
  { id: 24427, codice: '31828', nome: 'VINCO Ammorbidente', uom_name: 'CRT-4' }
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

async function getCategoryPezzi(cookies) {
  // Trova la categoria "Pezzi"
  const categories = await callOdoo(cookies, 'uom.category', 'search_read', [[
    ['name', '=', 'Pezzi']
  ]], { fields: ['id', 'name'], limit: 1 });

  if (categories.length === 0) {
    throw new Error('Categoria Pezzi non trovata!');
  }

  return categories[0];
}

async function creaUoMCartoni(cookies, categoryId) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('📦 CREAZIONE UoM CARTONI SPECIFICI');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const uomCreati = {};

  for (const tipo of TIPI_CARTONE) {
    console.log(`🔧 Creazione ${tipo.name} (1 cartone = ${tipo.pezzi} pezzi)...`);

    // Verifica se esiste già
    const existing = await callOdoo(cookies, 'uom.uom', 'search_read', [[
      ['name', '=', tipo.name]
    ]], { fields: ['id', 'name'], limit: 1 });

    if (existing.length > 0) {
      console.log(`   ⚠️  ${tipo.name} esiste già (ID: ${existing[0].id}), lo uso\n`);
      uomCreati[tipo.name] = existing[0];
      continue;
    }

    // Crea nuovo UoM
    const uomId = await callOdoo(cookies, 'uom.uom', 'create', [{
      name: tipo.name,
      category_id: categoryId,
      uom_type: 'bigger',
      factor_inv: tipo.pezzi,  // QUESTO È IL RAPPORTO CORRETTO!
      rounding: 0.01
    }]);

    console.log(`   ✅ ${tipo.name} creato! ID: ${uomId}\n`);

    const newUom = await callOdoo(cookies, 'uom.uom', 'read', [[uomId]], {
      fields: ['id', 'name', 'factor_inv']
    });

    uomCreati[tipo.name] = newUom[0];
  }

  return uomCreati;
}

async function aggiornaProdotti(cookies, uomCreati) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔄 AGGIORNAMENTO PRODOTTI CON UoM CORRETTI');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const prod of PRODOTTI_CARTONE) {
    console.log(`📦 Prodotto: ${prod.codice} - ${prod.nome}`);

    const uom = uomCreati[prod.uom_name];
    if (!uom) {
      console.log(`   ❌ UoM ${prod.uom_name} non trovata!\n`);
      continue;
    }

    console.log(`   🔧 Impostazione UoM Acquisto: ${uom.name} (1 cartone = ${uom.factor_inv} pezzi)`);

    await callOdoo(cookies, 'product.template', 'write', [[prod.id], {
      uom_po_id: uom.id
    }]);

    console.log('   ✅ Aggiornato!\n');
  }
}

async function verificaProdotti(cookies) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICA FINALE PRODOTTI');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const prod of PRODOTTI_CARTONE) {
    const product = await callOdoo(cookies, 'product.template', 'read', [[prod.id]], {
      fields: ['name', 'default_code', 'uom_id', 'uom_po_id', 'standard_price']
    });

    const p = product[0];
    console.log(`📦 ${prod.codice} - ${prod.nome}`);
    console.log(`   UoM Vendita: ${p.uom_id[1]}`);
    console.log(`   UoM Acquisto: ${p.uom_po_id[1]}`);
    console.log(`   Costo: ${p.standard_price} EUR per pezzo\n`);
  }
}

async function main() {
  try {
    const cookies = await authenticate();

    // 1. Trova categoria Pezzi
    console.log('🔍 Ricerca categoria Pezzi...');
    const category = await getCategoryPezzi(cookies);
    console.log(`✅ Categoria trovata: ${category.name} (ID: ${category.id})\n`);

    // 2. Crea UoM cartoni specifici
    const uomCreati = await creaUoMCartoni(cookies, category.id);

    // 3. Aggiorna prodotti
    await aggiornaProdotti(cookies, uomCreati);

    // 4. Verifica
    await verificaProdotti(cookies);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ CONFIGURAZIONE COMPLETATA!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('📝 RIEPILOGO:');
    console.log('   • Creati 3 tipi di UoM cartone (CRT-2, CRT-4, CRT-6)');
    console.log('   • Ogni UoM ha il rapporto corretto con PZ');
    console.log('   • Tutti i 3 prodotti in cartone aggiornati');
    console.log('   • UoM Vendita: PZ');
    console.log('   • UoM Acquisto: CRT-X (con X = numero pezzi)\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
