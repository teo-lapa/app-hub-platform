/**
 * Script COMPLETO per sistemare TUTTI i 26 prodotti dalla fattura GROMAS
 *
 * Azioni:
 * 1. Imposte fornitore: IVA 0% importazioni
 * 2. Imposte cliente: IVA 8.1%
 * 3. UoM corrette (CRT-X per cartoni, CONF per guanti, PZ per singoli)
 * 4. Prezzi fornitore corretti (per cartone/conf/pezzo)
 * 5. Costi interni corretti (per pezzo)
 * 6. Valuta: EUR
 * 7. Nome e codice prodotto fornitore
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// TUTTI i 26 prodotti dalla fattura GROMAS
const PRODOTTI_FATTURA = [
  { codice: '26425', descrizione: 'GUANTI NERI M NITRILE REFLEXX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29 },
  { codice: '032133', descrizione: 'SECCHIO CON STRIZZATORE RETT 12LT ZIF', tipo: 'SINGOLO', prezzo_fattura: 2.64 },
  { codice: '09632', descrizione: 'NEOFORT RAPIDO LT 0.75X6 +1SP', tipo: 'CRT-6', prezzo_fattura: 17.52 },
  { codice: '09731', descrizione: 'PULIVAT CONF 750 ML X 6 PZ', tipo: 'CRT-6', prezzo_fattura: 18.48 },
  { codice: '09733', descrizione: 'UNI5 SOAP IGIENIZZANTE BIANCO MANI 5KGX4', tipo: 'CRT-4', prezzo_fattura: 19.55 },
  { codice: '11563', descrizione: 'PULIGEN DISINCROSTANTE FLAC 1LT X12', tipo: 'CRT-12', prezzo_fattura: 5.5 },
  { codice: '270420', descrizione: 'EQO PIATTI A MANO TAN KG 5X4 INTER', tipo: 'CRT-4', prezzo_fattura: 18.0 },
  { codice: '270421', descrizione: 'EQO PAVIMENTI ARANCIA-LIM KG 5X4 INTER', tipo: 'CRT-4', prezzo_fattura: 15.84 },
  { codice: '270423', descrizione: 'EQO BAGNO ANTICALCARE LT0.75X6+6SP INTER', tipo: 'CRT-6', prezzo_fattura: 11.22 },
  { codice: '270425', descrizione: 'EQO LAVASTOVIGLIE TAN KG 5.5 X 2 INTER', tipo: 'CRT-2', prezzo_fattura: 13.1 },
  { codice: '31128', descrizione: 'RICAMBIO MOP SINTETICO', tipo: 'SINGOLO', prezzo_fattura: 3.14 },
  { codice: '26424', descrizione: 'GUANTI NERI L NITRILE REFLEX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29 },
  { codice: '50004', descrizione: 'PELLICOLA SUPERPACK 300 MT CHAMPAGNE BOX', tipo: 'SINGOLO', prezzo_fattura: 5.0 },
  { codice: '70114', descrizione: 'EFFICACE MULTIGEN IGIENIZZANTE 0.75LT X6', tipo: 'CRT-6', prezzo_fattura: 2.97 },
  { codice: '96855', descrizione: 'SACCHETTI CARTA BIANCO 14X30 B35 1000PZ', tipo: 'SINGOLO', prezzo_fattura: 19.25 },
  { codice: '39726', descrizione: 'ARGONIT AF/2 DISINFETTANTE LT0.75X6', tipo: 'CRT-6', prezzo_fattura: 19.8 },
  { codice: '31828', descrizione: 'VINCO AMMORBIDENTE M.BIANCO 5KG X4 INTER', tipo: 'CRT-4', prezzo_fattura: 7.7 },
  { codice: '270426', descrizione: 'EQO BRILLANTANTE TAN KG 5 X 2 INTER', tipo: 'CRT-2', prezzo_fattura: 15.08 },
  { codice: '411024', descrizione: 'POLIUNTO X2 GROMAS 800 STRAPPI', tipo: 'SINGOLO', prezzo_fattura: 6.55 },
  { codice: '26426', descrizione: 'GUANTI NERI S NITRILE REFLEXX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29 },
  { codice: '26423', descrizione: 'GUANTI NERI XL NITRILE REFLEX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29 },
  { codice: '270424', descrizione: 'EQO VETRI E MULT LT 0.75X6+6SP INTER', tipo: 'CRT-6', prezzo_fattura: 9.3 },
  { codice: '032123', descrizione: 'SPUGNA ZINCATA ACCIAIO 40GR x 25 pz ZIF', tipo: 'CRT-25', prezzo_fattura: 0.44 },
  { codice: '270422', descrizione: 'EQO SGRASSATORE LIM LT 0.75X6+6SP INTER', tipo: 'CRT-6', prezzo_fattura: 9.9 },
  { codice: '032120', descrizione: 'SCOPA CROMA ROSSO/NERO ZIF', tipo: 'SINGOLO', prezzo_fattura: 1.26 },
  { codice: '032124', descrizione: 'SPUGNA FIBRA 50PZ GROSSA ZIF', tipo: 'CRT-50', prezzo_fattura: 0.33 }
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

  // Trova IVA 0% importazioni (per fornitore)
  let taxImport0 = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['amount', '=', 0],
    ['type_tax_use', '=', 'purchase'],
    ['name', 'ilike', 'importazioni']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Se non trovata, cerca tutte le imposte acquisto 0%
  if (taxImport0.length === 0) {
    taxImport0 = await callOdoo(cookies, 'account.tax', 'search_read', [[
      ['amount', '=', 0],
      ['type_tax_use', '=', 'purchase']
    ]], { fields: ['id', 'name'], limit: 5 });
  }

  // Trova IVA 8.1% vendita (per cliente)
  const taxSale81 = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['amount', '=', 8.1],
    ['type_tax_use', '=', 'sale']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova EUR
  const eur = await callOdoo(cookies, 'res.currency', 'search_read', [[
    ['name', '=', 'EUR']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova GROMAS
  const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova categoria Pezzi
  const categoryPezzi = await callOdoo(cookies, 'uom.category', 'search_read', [[
    ['name', '=', 'Pezzi']
  ]], { fields: ['id', 'name'], limit: 1 });

  console.log('✅ IVA 0% importazioni:', taxImport0[0] ? taxImport0[0].name : 'NON TROVATA');
  console.log('✅ IVA 8.1% vendita:', taxSale81[0] ? taxSale81[0].name : 'NON TROVATA');
  console.log('✅ Valuta EUR:', eur[0] ? eur[0].name : 'NON TROVATA');
  console.log('✅ Fornitore GROMAS:', gromas[0] ? gromas[0].name : 'NON TROVATO');
  console.log('✅ Categoria Pezzi:', categoryPezzi[0] ? categoryPezzi[0].name : 'NON TROVATA');
  console.log('');

  if (!taxImport0[0] || !taxSale81[0] || !eur[0] || !gromas[0] || !categoryPezzi[0]) {
    throw new Error('Alcune risorse necessarie non sono state trovate!');
  }

  return {
    taxImport0: taxImport0[0],
    taxSale81: taxSale81[0],
    eur: eur[0],
    gromas: gromas[0],
    categoryPezzi: categoryPezzi[0]
  };
}

async function findOrCreateUoM(cookies, name, factor, categoryId, uomCache) {
  // Controlla cache
  if (uomCache[name]) {
    return uomCache[name];
  }

  // Cerca se esiste
  const existing = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', name]
  ]], { fields: ['id', 'name', 'factor_inv'], limit: 1 });

  if (existing.length > 0) {
    uomCache[name] = existing[0];
    return existing[0];
  }

  // Crea nuova UoM
  console.log(`   🔧 Creazione UoM ${name} (1 = ${factor} pezzi)...`);

  const uomId = await callOdoo(cookies, 'uom.uom', 'create', [{
    name: name,
    category_id: categoryId,
    uom_type: 'bigger',
    factor_inv: factor,
    rounding: 0.01
  }]);

  const newUom = await callOdoo(cookies, 'uom.uom', 'read', [[uomId]], {
    fields: ['id', 'name', 'factor_inv']
  });

  uomCache[name] = newUom[0];
  return newUom[0];
}

async function sistemaProdotto(cookies, resources, uomCache, uomPZ, prodotto, index, total) {
  console.log(`\n[${ index + 1}/${total}] 📦 ${prodotto.codice} - ${prodotto.descrizione.substring(0, 50)}...`);

  // 1. Cerca prodotto in Odoo
  const products = await callOdoo(cookies, 'product.template', 'search_read', [[
    '|',
    ['default_code', '=', prodotto.codice],
    ['default_code', 'ilike', prodotto.codice]
  ]], { fields: ['id', 'name', 'default_code'], limit: 1 });

  if (products.length === 0) {
    console.log('   ⚠️  Prodotto non trovato in Odoo, SKIP');
    return { status: 'not_found', codice: prodotto.codice };
  }

  const product = products[0];
  const productId = product.id;

  // 2. Determina UoM
  let uomVendita, uomAcquisto, costoPerPezzo;

  if (prodotto.tipo === 'SINGOLO') {
    // Prodotti singoli: PZ / PZ
    uomVendita = uomPZ;
    uomAcquisto = uomPZ;
    costoPerPezzo = prodotto.prezzo_fattura;
  } else if (prodotto.tipo === 'CONF') {
    // Guanti: CONF / CONF
    const uomConf = await findOrCreateUoM(cookies, 'CONF', 100, resources.categoryPezzi.id, uomCache);
    uomVendita = uomConf;
    uomAcquisto = uomConf;
    costoPerPezzo = prodotto.prezzo_fattura; // Costo per conf
  } else {
    // Cartoni: PZ / CRT-X
    const pezziPerCartone = parseInt(prodotto.tipo.split('-')[1]);
    const uomCartone = await findOrCreateUoM(cookies, prodotto.tipo, pezziPerCartone, resources.categoryPezzi.id, uomCache);
    uomVendita = uomPZ;
    uomAcquisto = uomCartone;
    costoPerPezzo = prodotto.prezzo_fattura / pezziPerCartone;
  }

  console.log(`   UoM: ${uomVendita.name} (vendita) / ${uomAcquisto.name} (acquisto)`);

  // 3. Aggiorna prodotto
  await callOdoo(cookies, 'product.template', 'write', [[productId], {
    uom_id: uomVendita.id,
    uom_po_id: uomAcquisto.id,
    standard_price: parseFloat(costoPerPezzo.toFixed(2)),
    taxes_id: [[6, 0, [resources.taxSale81.id]]]  // IVA 8.1% vendita
  }]);

  // 4. Aggiorna riga fornitore
  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', productId],
    ['partner_id', '=', resources.gromas.id]
  ]], { fields: ['id'], limit: 1 });

  if (supplierInfos.length > 0) {
    await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplierInfos[0].id], {
      product_name: prodotto.descrizione,
      product_code: prodotto.codice,
      price: prodotto.prezzo_fattura,
      currency_id: resources.eur.id,
      min_qty: 1.0
    }]);

    // Imposte fornitore: IVA 0% importazioni
    // NOTA: il campo potrebbe non essere disponibile su product.supplierinfo
    // In Odoo 17, le imposte fornitore sono sul prodotto, non sulla riga fornitore
  } else {
    console.log('   ⚠️  Riga fornitore non trovata');
  }

  // 5. Imposte fornitore sul prodotto (supplier_taxes_id)
  await callOdoo(cookies, 'product.template', 'write', [[productId], {
    supplier_taxes_id: [[6, 0, [resources.taxImport0.id]]]  // IVA 0% importazioni
  }]);

  console.log(`   ✅ Aggiornato: Costo ${costoPerPezzo.toFixed(2)} EUR, IVA 8.1%, Fornitore 0%`);

  return { status: 'ok', codice: prodotto.codice, id: productId };
}

async function main() {
  try {
    const cookies = await authenticate();
    const resources = await findResources(cookies);

    // Cache per UoM
    const uomCache = {};

    // Trova UoM PZ
    const uomPZ = await callOdoo(cookies, 'uom.uom', 'search_read', [[
      '|', ['name', '=', 'PZ'], ['name', '=', 'Unità']
    ]], { fields: ['id', 'name', 'factor_inv'], limit: 1 });

    if (uomPZ.length === 0) {
      throw new Error('UoM PZ non trovata!');
    }

    uomCache['PZ'] = uomPZ[0];

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`🚀 INIZIO SISTEMAZIONE ${PRODOTTI_FATTURA.length} PRODOTTI GROMAS`);
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const risultati = [];

    for (let i = 0; i < PRODOTTI_FATTURA.length; i++) {
      try {
        const result = await sistemaProdotto(
          cookies,
          resources,
          uomCache,
          uomPZ[0],
          PRODOTTI_FATTURA[i],
          i,
          PRODOTTI_FATTURA.length
        );
        risultati.push(result);
      } catch (error) {
        console.log(`   ❌ ERRORE: ${error.message}`);
        risultati.push({ status: 'error', codice: PRODOTTI_FATTURA[i].codice, error: error.message });
      }
    }

    // Riepilogo
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const ok = risultati.filter(r => r.status === 'ok').length;
    const notFound = risultati.filter(r => r.status === 'not_found').length;
    const errors = risultati.filter(r => r.status === 'error').length;

    console.log(`✅ Prodotti aggiornati: ${ok}`);
    console.log(`⚠️  Prodotti non trovati: ${notFound}`);
    console.log(`❌ Errori: ${errors}`);

    if (notFound > 0) {
      console.log('\n📋 Prodotti non trovati:');
      risultati.filter(r => r.status === 'not_found').forEach(r => {
        console.log(`   • ${r.codice}`);
      });
    }

    if (errors > 0) {
      console.log('\n❌ Prodotti con errori:');
      risultati.filter(r => r.status === 'error').forEach(r => {
        console.log(`   • ${r.codice}: ${r.error}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ SISTEMAZIONE COMPLETATA!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
