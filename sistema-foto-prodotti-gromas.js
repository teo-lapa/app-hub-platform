/**
 * Script per SISTEMARE i prodotti GROMAS con le FOTO CORRETTE
 *
 * PIANO:
 * 1. Elimino tutti i prodotti nuovi creati (senza foto)
 * 2. Riattivo i prodotti vecchi archiviati (con foto)
 * 3. Duplico i prodotti vecchi (così mantengono le foto)
 * 4. Modifico i duplicati con le UoM corrette
 * 5. Archivia i vecchi originali
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// I 5 prodotti con i loro ID vecchi archiviati
const PRODOTTI = [
  { codice: '26425', oldId: 24258, tipo: 'CONF', prezzo_fattura: 4.29 },
  { codice: '09731', oldId: 24248, tipo: 'CRT-6', prezzo_fattura: 18.48 },
  { codice: '270420', oldId: 24260, tipo: 'CRT-4', prezzo_fattura: 18.0 },
  { codice: '270421', oldId: 24261, tipo: 'CRT-4', prezzo_fattura: 15.84 },
  { codice: '270422', oldId: 24259, tipo: 'CRT-6', prezzo_fattura: 9.9 }
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

  const uomPZ = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    '|', ['name', '=', 'PZ'], ['name', '=', 'Unità']
  ]], { fields: ['id', 'name'], limit: 1 });

  const uomConf = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CONF']
  ]], { fields: ['id', 'name'], limit: 1 });

  const uomCrt4 = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CRT-4']
  ]], { fields: ['id', 'name'], limit: 1 });

  const uomCrt6 = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CRT-6']
  ]], { fields: ['id', 'name'], limit: 1 });

  const taxSale81 = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['amount', '=', 8.1],
    ['type_tax_use', '=', 'sale']
  ]], { fields: ['id', 'name'], limit: 1 });

  const taxImport0 = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['amount', '=', 0],
    ['type_tax_use', '=', 'purchase']
  ]], { fields: ['id', 'name'], limit: 1 });

  const eur = await callOdoo(cookies, 'res.currency', 'search_read', [[
    ['name', '=', 'EUR']
  ]], { fields: ['id', 'name'], limit: 1 });

  const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], { fields: ['id', 'name'], limit: 1 });

  console.log('✅ Risorse caricate\n');

  return {
    uomPZ: uomPZ[0],
    uomConf: uomConf[0],
    uomCrt4: uomCrt4[0],
    uomCrt6: uomCrt6[0],
    taxSale81: taxSale81[0],
    taxImport0: taxImport0[0],
    eur: eur[0],
    gromas: gromas[0]
  };
}

async function pulisciProdottiNuovi(cookies) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🗑️  STEP 1: ELIMINAZIONE PRODOTTI NUOVI (senza foto)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const prod of PRODOTTI) {
    console.log(`🗑️  Eliminazione prodotti ${prod.codice}...`);

    // Cerca TUTTI i prodotti attivi con questo codice
    const products = await callOdoo(cookies, 'product.template', 'search_read', [[
      ['default_code', '=', prod.codice],
      ['active', '=', true]
    ]], { fields: ['id', 'name'], limit: 10 });

    console.log(`   Trovati ${products.length} prodotti attivi`);

    // Elimina TUTTI i prodotti nuovi
    for (const p of products) {
      try {
        await callOdoo(cookies, 'product.template', 'unlink', [[p.id]]);
        console.log(`   ✅ Eliminato ID ${p.id}`);
      } catch (error) {
        console.log(`   ⚠️  Impossibile eliminare ID ${p.id}: ${error.message}`);
      }
    }

    console.log('');
  }
}

async function riattivaProdottiVecchi(cookies) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔄 STEP 2: RIATTIVAZIONE PRODOTTI VECCHI (con foto)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const prod of PRODOTTI) {
    console.log(`🔄 Riattivazione prodotto ${prod.codice} (ID: ${prod.oldId})...`);

    try {
      // Riattiva il prodotto vecchio
      await callOdoo(cookies, 'product.template', 'write', [[prod.oldId], {
        active: true
      }]);

      console.log(`   ✅ Riattivato!\n`);
    } catch (error) {
      console.log(`   ⚠️  Errore: ${error.message}\n`);
    }
  }
}

async function duplicaEModifica(cookies, resources, prodotto) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`📦 STEP 3: ${prodotto.codice} - Duplicazione e modifica`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`   📋 Duplicazione del prodotto vecchio (ID: ${prodotto.oldId})...`);

  // DUPLICA il prodotto vecchio (con foto!)
  const duplicatoId = await callOdoo(cookies, 'product.template', 'copy', [prodotto.oldId], {
    default: {}
  });

  console.log(`   ✅ Duplicato creato! ID: ${duplicatoId}\n`);

  // Determina UoM corrette
  let uomVendita, uomAcquisto, costoPerPezzo;

  if (prodotto.tipo === 'CONF') {
    uomVendita = resources.uomConf;
    uomAcquisto = resources.uomConf;
    costoPerPezzo = prodotto.prezzo_fattura;
  } else if (prodotto.tipo === 'CRT-4') {
    uomVendita = resources.uomPZ;
    uomAcquisto = resources.uomCrt4;
    costoPerPezzo = prodotto.prezzo_fattura / 4;
  } else if (prodotto.tipo === 'CRT-6') {
    uomVendita = resources.uomPZ;
    uomAcquisto = resources.uomCrt6;
    costoPerPezzo = prodotto.prezzo_fattura / 6;
  }

  console.log(`   🔧 Aggiornamento UoM e prezzi...`);
  console.log(`      UoM Vendita: ${uomVendita.name}`);
  console.log(`      UoM Acquisto: ${uomAcquisto.name}`);
  console.log(`      Costo: ${costoPerPezzo.toFixed(2)} EUR`);

  // Aggiorna il DUPLICATO con UoM corrette
  await callOdoo(cookies, 'product.template', 'write', [[duplicatoId], {
    uom_id: uomVendita.id,
    uom_po_id: uomAcquisto.id,
    standard_price: parseFloat(costoPerPezzo.toFixed(2)),
    taxes_id: [[6, 0, [resources.taxSale81.id]]],
    supplier_taxes_id: [[6, 0, [resources.taxImport0.id]]]
  }]);

  console.log(`   ✅ Duplicato aggiornato!\n`);

  // Aggiorna info fornitore
  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', duplicatoId],
    ['partner_id', '=', resources.gromas.id]
  ]], { fields: ['id'], limit: 1 });

  if (supplierInfos.length > 0) {
    await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplierInfos[0].id], {
      price: prodotto.prezzo_fattura,
      currency_id: resources.eur.id
    }]);
    console.log(`   ✅ Fornitore aggiornato!\n`);
  }

  // Crea packaging se necessario
  if (prodotto.tipo.startsWith('CRT-')) {
    console.log(`   📦 Creazione imballaggio...`);

    const pezziPerCartone = parseInt(prodotto.tipo.split('-')[1]);

    const productVariants = await callOdoo(cookies, 'product.product', 'search_read', [[
      ['product_tmpl_id', '=', duplicatoId]
    ]], { fields: ['id'], limit: 1 });

    if (productVariants.length > 0) {
      const packagingData = {
        product_id: productVariants[0].id,
        name: 'CARTONE',
        qty: pezziPerCartone,
        sales: true,
        purchase: true
      };

      await callOdoo(cookies, 'product.packaging', 'create', [packagingData]);
      console.log(`   ✅ Imballaggio creato!\n`);
    }
  }

  // Archivia il vecchio
  console.log(`   🗄️  Archiviazione prodotto vecchio (ID: ${prodotto.oldId})...`);
  await callOdoo(cookies, 'product.template', 'write', [[prodotto.oldId], {
    active: false
  }]);
  console.log(`   ✅ Vecchio archiviato!\n`);

  console.log(`✅ COMPLETATO! Il duplicato (ID ${duplicatoId}) ha la foto!\n`);

  return { status: 'ok', codice: prodotto.codice, newId: duplicatoId };
}

async function main() {
  try {
    const cookies = await authenticate();
    const resources = await findResources(cookies);

    // STEP 1: Elimina tutti i prodotti nuovi (senza foto)
    await pulisciProdottiNuovi(cookies);

    // STEP 2: Riattiva i prodotti vecchi (con foto)
    await riattivaProdottiVecchi(cookies);

    // STEP 3: Duplica i vecchi e modifica
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🔄 STEP 3: DUPLICAZIONE E MODIFICA');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const risultati = [];

    for (const prod of PRODOTTI) {
      try {
        const result = await duplicaEModifica(cookies, resources, prod);
        risultati.push(result);
      } catch (error) {
        console.log(`   ❌ ERRORE: ${error.message}\n`);
        risultati.push({ status: 'error', codice: prod.codice, error: error.message });
      }
    }

    // Riepilogo
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const ok = risultati.filter(r => r.status === 'ok').length;
    const errors = risultati.filter(r => r.status === 'error').length;

    console.log(`✅ Prodotti con foto sistemati: ${ok}`);
    console.log(`❌ Errori: ${errors}`);

    console.log('\n📸 ADESSO I PRODOTTI HANNO LE FOTO DEI VECCHI!\n');

    if (errors > 0) {
      console.log('\n❌ Prodotti con errori:');
      risultati.filter(r => r.status === 'error').forEach(r => {
        console.log(`   • ${r.codice}: ${r.error}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ OPERAZIONE COMPLETATA!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
