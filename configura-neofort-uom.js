/**
 * Script per configurare UoM CARTONE per NEOFORT
 * - Verifica/crea UoM CARTONE (1 CARTONE = 6 PZ)
 * - Aggiorna prodotto NEOFORT per acquisto a CARTONE
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODUCT_ID = 23107; // NEOFORT RAPIDO
const CARTONE_PEZZI = 6; // 1 cartone = 6 pezzi

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

async function findUomPZ(cookies) {
  console.log('\n🔍 Ricerca UoM PZ (Pezzo)...');

  const uoms = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'PZ']
  ]], {
    fields: ['id', 'name', 'category_id', 'uom_type', 'factor', 'rounding']
  });

  if (uoms.length === 0) {
    // Prova con "Unità" che è lo standard
    const uomsUnita = await callOdoo(cookies, 'uom.uom', 'search_read', [[
      '|',
      ['name', '=', 'Unità'],
      ['name', '=', 'Units']
    ]], {
      fields: ['id', 'name', 'category_id', 'uom_type', 'factor', 'rounding']
    });

    if (uomsUnita.length > 0) {
      console.log('✅ Trovata UoM base:', uomsUnita[0].name, `(ID: ${uomsUnita[0].id})`);
      return uomsUnita[0];
    }

    throw new Error('UoM base PZ/Unità non trovato');
  }

  console.log('✅ Trovata UoM PZ:', uoms[0].name, `(ID: ${uoms[0].id})`);
  return uoms[0];
}

async function findOrCreateCartoneUom(cookies, uomPZ) {
  console.log('\n🔍 Ricerca UoM CARTONE...');

  // Cerca se esiste già
  const existingUoms = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    '|',
    ['name', '=', 'CARTONE'],
    ['name', 'ilike', 'cartone']
  ]], {
    fields: ['id', 'name', 'category_id', 'uom_type', 'factor', 'factor_inv', 'rounding']
  });

  if (existingUoms.length > 0) {
    const cartone = existingUoms[0];
    console.log('✅ UoM CARTONE già esistente:', cartone.name, `(ID: ${cartone.id})`);
    console.log('   Factor:', cartone.factor, '| Factor Inv:', cartone.factor_inv);

    // Verifica se il fattore è corretto (1 CARTONE = 6 PZ significa factor_inv = 6)
    if (cartone.factor_inv !== CARTONE_PEZZI) {
      console.log(`⚠️  Il fattore attuale è ${cartone.factor_inv}, dovrebbe essere ${CARTONE_PEZZI}`);
      console.log('   Aggiorno il fattore...');

      await callOdoo(cookies, 'uom.uom', 'write', [[cartone.id], {
        factor_inv: CARTONE_PEZZI,
        factor: 1 / CARTONE_PEZZI
      }]);

      console.log('✅ Fattore aggiornato!');
    }

    return cartone;
  }

  // Crea nuovo UoM CARTONE
  console.log('📦 Creazione nuovo UoM CARTONE...');
  console.log(`   1 CARTONE = ${CARTONE_PEZZI} PZ`);

  const cartoneId = await callOdoo(cookies, 'uom.uom', 'create', [{
    name: 'CARTONE',
    category_id: uomPZ.category_id[0], // Stessa categoria dell'UoM base
    uom_type: 'bigger', // Più grande dell'unità base
    factor_inv: CARTONE_PEZZI, // 1 CARTONE = 6 PZ
    factor: 1 / CARTONE_PEZZI, // Inverso
    rounding: 1.0
  }]);

  console.log('✅ UoM CARTONE creato con successo! ID:', cartoneId);

  return {
    id: cartoneId,
    name: 'CARTONE',
    factor_inv: CARTONE_PEZZI
  };
}

async function updateProduct(cookies, uomPZ, uomCartone) {
  console.log('\n📝 Aggiornamento prodotto NEOFORT (ID:', PRODUCT_ID, ')...');

  // Prima leggi il prodotto attuale
  const product = await callOdoo(cookies, 'product.product', 'read', [[PRODUCT_ID]], {
    fields: ['name', 'uom_id', 'uom_po_id']
  });

  console.log('\n📋 Configurazione ATTUALE:');
  console.log('   Nome:', product[0].name);
  console.log('   UoM vendita (uom_id):', product[0].uom_id[1]);
  console.log('   UoM acquisto (uom_po_id):', product[0].uom_po_id[1]);

  // Aggiorna con CARTONE per acquisto
  await callOdoo(cookies, 'product.product', 'write', [[PRODUCT_ID], {
    uom_po_id: uomCartone.id // UoM acquisto = CARTONE
    // uom_id rimane PZ (per vendita)
  }]);

  console.log('\n✅ Prodotto aggiornato!');

  // Rileggi per conferma
  const updatedProduct = await callOdoo(cookies, 'product.product', 'read', [[PRODUCT_ID]], {
    fields: ['name', 'uom_id', 'uom_po_id', 'standard_price']
  });

  console.log('\n📋 Configurazione NUOVA:');
  console.log('   Nome:', updatedProduct[0].name);
  console.log('   UoM vendita (uom_id):', updatedProduct[0].uom_id[1], '← Per vendere a PEZZO');
  console.log('   UoM acquisto (uom_po_id):', updatedProduct[0].uom_po_id[1], '← Per comprare a CARTONE');
  console.log('   Costo:', updatedProduct[0].standard_price, '€');

  console.log('\n💡 NOTA: Il costo attuale è per PEZZO.');
  console.log(`   Se il costo di 17.52€ è per CARTONE, dovresti dividerlo per ${CARTONE_PEZZI} = ${(17.52 / CARTONE_PEZZI).toFixed(2)}€/pezzo`);

  return updatedProduct[0];
}

async function main() {
  try {
    const cookies = await authenticate();

    // Step 1: Trova UoM PZ
    const uomPZ = await findUomPZ(cookies);

    // Step 2: Trova o crea UoM CARTONE
    const uomCartone = await findOrCreateCartoneUom(cookies, uomPZ);

    // Step 3: Aggiorna prodotto
    await updateProduct(cookies, uomPZ, uomCartone);

    console.log('\n🎉 CONFIGURAZIONE COMPLETATA!');
    console.log('\n📦 Ora puoi:');
    console.log('   ✅ ACQUISTARE in CARTONI (1 cartone = 6 pezzi)');
    console.log('   ✅ VENDERE in PEZZI singoli');
    console.log('   ✅ La giacenza sarà sempre in PEZZI');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
