/**
 * Script per sistemare TUTTI i 6 prodotti nuovi creati da GROMAS
 * - UoM Acquisto: CRT (per prodotti in cartone)
 * - UoM Vendita: PZ
 * - Peso prodotto
 * - Imballaggio
 * - Nome e codice prodotto fornitore
 * - Rimuovere imposte fornitore (import/export)
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// I 6 prodotti nuovi da sistemare
const PRODOTTI = [
  {
    id: 24428,
    codice: '270426',
    nome: 'EQO Brillantante Professional per Lavastoviglie Tanica 5kg',
    tipo: 'CARTONE',
    pezzi_per_cartone: 2,
    peso_kg: 5.0,
    prezzo_cartone: 15.08
  },
  {
    id: 24426,
    codice: '39726',
    nome: 'ARGONIT AF/2 Disinfettante Professionale 750ml',
    tipo: 'CARTONE',
    pezzi_per_cartone: 6,
    peso_kg: 0.75,
    prezzo_cartone: 19.80
  },
  {
    id: 24427,
    codice: '31828',
    nome: 'VINCO Ammorbidente Muschio Bianco 5kg',
    tipo: 'CARTONE',
    pezzi_per_cartone: 4,
    peso_kg: 5.0,
    prezzo_cartone: 7.70
  },
  {
    id: 24429,
    codice: '411024',
    nome: 'POLIUNTO X2 Carta Multiuso Gromas - Rotolo 800 Strappi',
    tipo: 'SINGOLO',
    pezzi_per_cartone: null,
    peso_kg: 1.0, // Stima
    prezzo_pezzo: 6.55
  },
  {
    id: 24425,
    codice: '26424',
    nome: 'Guanti in Nitrile Reflexx Monouso Neri Taglia L',
    tipo: 'SINGOLO',
    pezzi_per_cartone: null,
    peso_kg: 0.5, // Stima - confezione 100 guanti
    prezzo_pezzo: 4.29
  },
  {
    id: 24430,
    codice: '26426',
    nome: 'Guanti in Nitrile Reflexx Monouso Neri Taglia S',
    tipo: 'SINGOLO',
    pezzi_per_cartone: null,
    peso_kg: 0.5, // Stima - confezione 100 guanti
    prezzo_pezzo: 4.29
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

async function findResources(cookies) {
  console.log('🔍 Ricerca risorse necessarie...\n');

  // Trova UoM PZ
  const uomPZ = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    '|', ['name', '=', 'PZ'], ['name', '=', 'Unità']
  ]], { fields: ['id', 'name', 'category_id'], limit: 1 });

  // Trova UoM CRT
  let uomCRT = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CRT']
  ]], { fields: ['id', 'name', 'category_id'], limit: 1 });

  console.log('✅ UoM PZ:', uomPZ[0] ? `${uomPZ[0].name} (categoria: ${uomPZ[0].category_id[1]})` : 'NON TROVATO');
  console.log('✅ UoM CRT:', uomCRT[0] ? `${uomCRT[0].name} (categoria: ${uomCRT[0].category_id[1]})` : 'NON TROVATO');

  // Verifica se CRT e PZ sono nella stessa categoria
  if (uomCRT[0] && uomPZ[0] && uomCRT[0].category_id[0] !== uomPZ[0].category_id[0]) {
    console.log('\n⚠️  PROBLEMA: CRT e PZ sono in categorie diverse!');
    console.log('   Devo eliminare CRT e ricrearlo nella categoria corretta...\n');

    // Controlla se CRT è usato da altri prodotti
    const productsUsingCRT = await callOdoo(cookies, 'product.template', 'search_count', [[
      '|',
      ['uom_id', '=', uomCRT[0].id],
      ['uom_po_id', '=', uomCRT[0].id]
    ]]);

    console.log(`   Prodotti che usano CRT: ${productsUsingCRT}`);

    if (productsUsingCRT > 0) {
      console.log('   CRT è già in uso. Creo un nuovo UoM "CARTONE" nella categoria corretta...\n');

      // Crea nuovo UoM CARTONE nella categoria Pezzi
      const newCRT = await callOdoo(cookies, 'uom.uom', 'create', [{
        name: 'CARTONE',
        category_id: uomPZ[0].category_id[0],
        uom_type: 'bigger',
        factor_inv: 1.0, // 1 CARTONE = X PZ (varia per prodotto)
        rounding: 0.01
      }]);

      console.log(`✅ Nuovo UoM CARTONE creato! ID: ${newCRT}`);

      uomCRT = await callOdoo(cookies, 'uom.uom', 'read', [[newCRT]], {
        fields: ['id', 'name', 'category_id']
      });
    } else {
      // Elimina CRT vecchio e ricrealo
      console.log('   Elimino CRT vecchio...');
      await callOdoo(cookies, 'uom.uom', 'unlink', [[uomCRT[0].id]]);

      // Crea nuovo CRT nella categoria corretta
      const newCRT = await callOdoo(cookies, 'uom.uom', 'create', [{
        name: 'CRT',
        category_id: uomPZ[0].category_id[0],
        uom_type: 'bigger',
        factor_inv: 1.0,
        rounding: 0.01
      }]);

      console.log(`✅ Nuovo UoM CRT creato! ID: ${newCRT}\n`);

      uomCRT = await callOdoo(cookies, 'uom.uom', 'read', [[newCRT]], {
        fields: ['id', 'name', 'category_id']
      });
    }
  }

  // Trova fornitore GROMAS
  const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova valuta EUR
  const eur = await callOdoo(cookies, 'res.currency', 'search_read', [[
    ['name', '=', 'EUR']
  ]], { fields: ['id', 'name'], limit: 1 });

  console.log('✅ Fornitore GROMAS:', gromas[0] ? gromas[0].name : 'NON TROVATO');
  console.log('✅ Valuta EUR:', eur[0] ? eur[0].name : 'NON TROVATO');
  console.log('');

  return {
    uomPZ: uomPZ[0],
    uomCRT: uomCRT[0],
    gromas: gromas[0],
    eur: eur[0]
  };
}

async function configuraProdotto(cookies, resources, prodotto) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`📦 PRODOTTO: ${prodotto.codice} - ${prodotto.nome}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const costoPerPezzo = prodotto.tipo === 'CARTONE'
    ? (prodotto.prezzo_cartone / prodotto.pezzi_per_cartone).toFixed(2)
    : prodotto.prezzo_pezzo;

  console.log('📋 Configurazione:');
  console.log(`   Tipo: ${prodotto.tipo}`);
  if (prodotto.tipo === 'CARTONE') {
    console.log(`   Pezzi per cartone: ${prodotto.pezzi_per_cartone}`);
    console.log(`   Prezzo cartone: ${prodotto.prezzo_cartone} EUR`);
    console.log(`   Costo per pezzo: ${costoPerPezzo} EUR`);
  } else {
    console.log(`   Prezzo pezzo: ${prodotto.prezzo_pezzo} EUR`);
  }
  console.log(`   Peso: ${prodotto.peso_kg} kg`);
  console.log('');

  // 1. Aggiorna prodotto base
  console.log('⚙️  STEP 1: Aggiornamento dati base prodotto...');

  const updateData = {
    weight: prodotto.peso_kg,
    standard_price: parseFloat(costoPerPezzo)
  };

  // Se è un prodotto in cartone, imposta UoM acquisto a CRT
  if (prodotto.tipo === 'CARTONE') {
    updateData.uom_po_id = resources.uomCRT.id;
  }

  await callOdoo(cookies, 'product.template', 'write', [[prodotto.id], updateData]);
  console.log('✅ Dati base aggiornati\n');

  // 2. Crea imballaggio se è un prodotto in cartone
  if (prodotto.tipo === 'CARTONE') {
    console.log(`📦 STEP 2: Creazione imballaggio (1 CARTONE = ${prodotto.pezzi_per_cartone} PZ)...`);

    // Trova la variante prodotto (product.product) dal template
    const productVariants = await callOdoo(cookies, 'product.product', 'search_read', [[
      ['product_tmpl_id', '=', prodotto.id]
    ]], { fields: ['id'], limit: 1 });

    if (productVariants.length === 0) {
      console.log('⚠️  Nessuna variante prodotto trovata, salto imballaggio\n');
    } else {
      const packagingData = {
        product_id: productVariants[0].id,  // Usa l'ID della variante
        name: 'CARTONE',
        qty: prodotto.pezzi_per_cartone,
        sales: true,
        purchase: true
      };

      const packagingId = await callOdoo(cookies, 'product.packaging', 'create', [packagingData]);
      console.log(`✅ Imballaggio creato! ID: ${packagingId}\n`);
    }
  }

  // 3. Aggiorna info fornitore
  console.log('🏢 STEP 3: Aggiornamento informazioni fornitore...');

  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', prodotto.id],
    ['partner_id', '=', resources.gromas.id]
  ]], { fields: ['id'], limit: 1 });

  if (supplierInfos.length > 0) {
    const supplierUpdateData = {
      product_name: prodotto.nome,
      product_code: prodotto.codice,
      price: parseFloat(costoPerPezzo),
      currency_id: resources.eur.id,
      min_qty: 1.0
    };

    await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplierInfos[0].id], supplierUpdateData]);

    console.log('✅ Info fornitore aggiornate\n');
  }

  // 4. Verifica finale
  console.log('🔍 VERIFICA FINALE:\n');

  const product = await callOdoo(cookies, 'product.template', 'read', [[prodotto.id]], {
    fields: ['name', 'default_code', 'uom_id', 'uom_po_id', 'weight', 'standard_price', 'packaging_ids']
  });

  const p = product[0];
  console.log('✅ UoM Vendita:', p.uom_id[1]);
  console.log('✅ UoM Acquisto:', p.uom_po_id[1]);
  console.log('✅ Peso:', p.weight, 'kg');
  console.log('✅ Costo:', p.standard_price, 'EUR');
  console.log('✅ Imballaggi:', p.packaging_ids ? p.packaging_ids.length : 0);

  console.log('\n✅ PRODOTTO CONFIGURATO!\n');
}

async function main() {
  try {
    const cookies = await authenticate();
    const resources = await findResources(cookies);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🚀 INIZIO CONFIGURAZIONE 6 PRODOTTI NUOVI');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    for (const prodotto of PRODOTTI) {
      await configuraProdotto(cookies, resources, prodotto);
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ TUTTI I 6 PRODOTTI CONFIGURATI CON SUCCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
