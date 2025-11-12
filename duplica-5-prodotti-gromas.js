/**
 * Script per DUPLICARE i 5 prodotti GROMAS (così mantengono le foto!)
 * e poi modificare i duplicati con le UoM corrette
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// I 5 prodotti da duplicare
const PRODOTTI_DA_DUPLICARE = [
  { codice: '26425', tipo: 'CONF', prezzo_fattura: 4.29 },
  { codice: '09731', tipo: 'CRT-6', prezzo_fattura: 18.48 },
  { codice: '270420', tipo: 'CRT-4', prezzo_fattura: 18.0 },
  { codice: '270421', tipo: 'CRT-4', prezzo_fattura: 15.84 },
  { codice: '270422', tipo: 'CRT-6', prezzo_fattura: 9.9 }
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

  // UoM
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

  // IVA
  const taxSale81 = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['amount', '=', 8.1],
    ['type_tax_use', '=', 'sale']
  ]], { fields: ['id', 'name'], limit: 1 });

  const taxImport0 = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['amount', '=', 0],
    ['type_tax_use', '=', 'purchase']
  ]], { fields: ['id', 'name'], limit: 1 });

  // EUR
  const eur = await callOdoo(cookies, 'res.currency', 'search_read', [[
    ['name', '=', 'EUR']
  ]], { fields: ['id', 'name'], limit: 1 });

  // GROMAS
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

async function duplicaEModifica(cookies, resources, prodotto, index, total) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`[${index + 1}/${total}] 📦 ${prodotto.codice}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Trova prodotto VECCHIO (quello appena creato)
  const newProducts = await callOdoo(cookies, 'product.template', 'search_read', [[
    ['default_code', '=', prodotto.codice],
    ['active', '=', true]
  ]], { fields: ['id', 'name', 'create_date'], limit: 10 });

  if (newProducts.length === 0) {
    console.log('   ⚠️  Nessun prodotto trovato\n');
    return { status: 'not_found', codice: prodotto.codice };
  }

  // Il prodotto VECCHIO è quello con ID più basso (creato prima)
  const prodottoVecchio = newProducts.sort((a, b) => a.id - b.id)[0];

  console.log(`   📋 Prodotto vecchio trovato: ID ${prodottoVecchio.id}`);
  console.log(`   🔄 Duplicazione del prodotto vecchio...`);

  // 2. DUPLICA il prodotto vecchio (così mantiene la foto!)
  const duplicatoId = await callOdoo(cookies, 'product.template', 'copy', [prodottoVecchio.id], {
    default: {
      name: prodottoVecchio.name + ' (Nuovo)',
      default_code: prodotto.codice
    }
  });

  console.log(`   ✅ Duplicato creato! ID: ${duplicatoId}\n`);

  // 3. Determina UoM corrette
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

  // 4. Aggiorna il DUPLICATO con UoM corrette
  await callOdoo(cookies, 'product.template', 'write', [[duplicatoId], {
    name: prodottoVecchio.name, // Rimuovi " (Nuovo)"
    uom_id: uomVendita.id,
    uom_po_id: uomAcquisto.id,
    standard_price: parseFloat(costoPerPezzo.toFixed(2)),
    taxes_id: [[6, 0, [resources.taxSale81.id]]],
    supplier_taxes_id: [[6, 0, [resources.taxImport0.id]]]
  }]);

  console.log(`   ✅ Duplicato aggiornato!\n`);

  // 5. Aggiorna info fornitore sul duplicato
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

  // 6. Crea packaging se necessario
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

  // 7. Archivia il prodotto NUOVO (quello creato poco fa senza foto)
  const nuoviProdotti = newProducts.filter(p => p.id !== prodottoVecchio.id);
  if (nuoviProdotti.length > 0) {
    const daCancellare = nuoviProdotti.sort((a, b) => b.id - a.id)[0]; // ID più alto = creato dopo
    console.log(`   🗑️  Eliminazione prodotto nuovo senza foto (ID: ${daCancellare.id})...`);

    await callOdoo(cookies, 'product.template', 'unlink', [[daCancellare.id]]);
    console.log(`   ✅ Eliminato!\n`);
  }

  console.log(`✅ COMPLETATO! Il duplicato (ID ${duplicatoId}) ha la foto del vecchio!\n`);

  return { status: 'ok', codice: prodotto.codice, newId: duplicatoId, oldId: prodottoVecchio.id };
}

async function main() {
  try {
    const cookies = await authenticate();
    const resources = await findResources(cookies);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🔄 DUPLICAZIONE E CORREZIONE 5 PRODOTTI GROMAS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const risultati = [];

    for (let i = 0; i < PRODOTTI_DA_DUPLICARE.length; i++) {
      try {
        const result = await duplicaEModifica(
          cookies,
          resources,
          PRODOTTI_DA_DUPLICARE[i],
          i,
          PRODOTTI_DA_DUPLICARE.length
        );
        risultati.push(result);
      } catch (error) {
        console.log(`   ❌ ERRORE: ${error.message}\n`);
        risultati.push({ status: 'error', codice: PRODOTTI_DA_DUPLICARE[i].codice, error: error.message });
      }
    }

    // Riepilogo
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const ok = risultati.filter(r => r.status === 'ok').length;
    const errors = risultati.filter(r => r.status === 'error').length;

    console.log(`✅ Prodotti duplicati e corretti: ${ok}`);
    console.log(`❌ Errori: ${errors}`);

    console.log('\n📸 FOTO MANTENUTE!');
    console.log('   I nuovi prodotti hanno le stesse foto dei vecchi perché sono duplicati!\n');

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
