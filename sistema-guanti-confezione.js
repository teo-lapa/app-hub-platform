/**
 * Script per sistemare i guanti con UoM CONFEZIONE
 *
 * Struttura guanti:
 * - CARTONE → contiene X confezioni
 * - CONFEZIONE → contiene 100 guanti (unità base di vendita e acquisto)
 * - PEZZO → singolo guanto (ma non si vende a pezzo)
 *
 * Per i guanti:
 * - UoM Vendita: CONFEZIONE
 * - UoM Acquisto: CONFEZIONE
 * - Prezzo: 4.29 EUR per CONFEZIONE (100 guanti)
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const GUANTI = [
  { id: 24425, codice: '26424', nome: 'Guanti L', taglia: 'L', prezzo: 4.29 },
  { id: 24430, codice: '26426', nome: 'Guanti S', taglia: 'S', prezzo: 4.29 }
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

async function findOrCreateUoMConfezione(cookies, categoryId) {
  console.log('🔍 Ricerca UoM CONF...');

  // Verifica se esiste già
  let uomConfezione = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CONF']
  ]], { fields: ['id', 'name', 'category_id', 'factor_inv'], limit: 1 });

  if (uomConfezione.length > 0) {
    console.log(`✅ CONF esiste già (ID: ${uomConfezione[0].id})\n`);
    return uomConfezione[0];
  }

  // Crea UoM CONF
  console.log('🔧 Creazione UoM CONF...');

  const uomId = await callOdoo(cookies, 'uom.uom', 'create', [{
    name: 'CONF',
    category_id: categoryId,
    uom_type: 'bigger',
    factor_inv: 100.0,  // 1 CONF = 100 pezzi (guanti)
    rounding: 0.01
  }]);

  console.log(`✅ CONF creata! ID: ${uomId}\n`);

  const newUom = await callOdoo(cookies, 'uom.uom', 'read', [[uomId]], {
    fields: ['id', 'name', 'category_id', 'factor_inv']
  });

  return newUom[0];
}

async function aggiornaGuanto(cookies, uomConfezioneId, gromasId, guanto) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`🧤 ${guanto.codice} - ${guanto.nome}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('📋 Configurazione:');
  console.log(`   UoM Vendita: CONF`);
  console.log(`   UoM Acquisto: CONF`);
  console.log(`   Prezzo fornitore: ${guanto.prezzo} EUR per CONF (100 guanti)`);
  console.log(`   Costo interno: ${guanto.prezzo} EUR per CONF`);
  console.log('');

  // 1. Aggiorna UoM del prodotto
  console.log('⚙️  STEP 1: Aggiornamento UoM prodotto...');

  await callOdoo(cookies, 'product.template', 'write', [[guanto.id], {
    uom_id: uomConfezioneId,
    uom_po_id: uomConfezioneId,
    standard_price: guanto.prezzo
  }]);

  console.log('✅ UoM aggiornate a CONF\n');

  // 2. Aggiorna prezzo fornitore
  console.log('🏢 STEP 2: Aggiornamento prezzo fornitore...');

  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', guanto.id],
    ['partner_id', '=', gromasId]
  ]], { fields: ['id'], limit: 1 });

  if (supplierInfos.length > 0) {
    await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplierInfos[0].id], {
      price: guanto.prezzo
    }]);
    console.log('✅ Prezzo fornitore aggiornato\n');
  } else {
    console.log('⚠️  Riga fornitore non trovata\n');
  }

  // 3. Verifica finale
  console.log('🔍 Verifica finale:');

  const product = await callOdoo(cookies, 'product.template', 'read', [[guanto.id]], {
    fields: ['name', 'uom_id', 'uom_po_id', 'standard_price']
  });

  const p = product[0];
  console.log(`   UoM Vendita: ${p.uom_id[1]}`);
  console.log(`   UoM Acquisto: ${p.uom_po_id[1]}`);
  console.log(`   Costo: ${p.standard_price} EUR per ${p.uom_id[1]}`);

  if (supplierInfos.length > 0) {
    const supplierInfo = await callOdoo(cookies, 'product.supplierinfo', 'read', [[supplierInfos[0].id]], {
      fields: ['price', 'currency_id']
    });
    console.log(`   Prezzo fornitore: ${supplierInfo[0].price} EUR per ${p.uom_po_id[1]}`);
  }

  console.log('\n✅ GUANTO CONFIGURATO!\n');
}

async function main() {
  try {
    const cookies = await authenticate();

    // 1. Trova categoria Pezzi
    console.log('🔍 Ricerca categoria Pezzi...');
    const category = await getCategoryPezzi(cookies);
    console.log(`✅ Categoria trovata: ${category.name} (ID: ${category.id})\n`);

    // 2. Trova o crea UoM CONFEZIONE
    const uomConfezione = await findOrCreateUoMConfezione(cookies, category.id);

    // 3. Trova GROMAS
    console.log('🔍 Ricerca fornitore GROMAS...');
    const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
      ['name', 'ilike', 'GROMAS']
    ]], { fields: ['id', 'name'], limit: 1 });
    console.log(`✅ Trovato: ${gromas[0].name} (ID: ${gromas[0].id})\n`);

    // 4. Aggiorna ogni guanto
    for (const guanto of GUANTI) {
      await aggiornaGuanto(cookies, uomConfezione.id, gromas[0].id, guanto);
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ GUANTI CONFIGURATI CON SUCCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('📝 RIEPILOGO:');
    console.log('   • Creata UoM CONF (1 conf = 100 guanti)');
    console.log('   • Guanti L e S configurati con UoM CONF');
    console.log('   • Prezzo: 4.29 EUR per CONF');
    console.log('   • Si vendono e si comprano a CONF, non a pezzo\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
