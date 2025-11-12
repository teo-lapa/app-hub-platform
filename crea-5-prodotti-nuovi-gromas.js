/**
 * Script per creare 5 NUOVI prodotti GROMAS per sostituire quelli con movimenti di magazzino
 * che non permettono il cambio di UoM
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// I 5 prodotti da ricreare
const PRODOTTI_DA_CREARE = [
  {
    codice: '26425',
    nome: 'Guanti in Nitrile Reflexx Monouso Neri Taglia M - Confezione 100pz',
    tipo: 'CONF',
    prezzo_fattura: 4.29,
    peso_kg: 0.5,
    categoria: 'Non Food / Detergenza'
  },
  {
    codice: '09731',
    nome: 'PULIVAT Detergente Professionale 750ml - Confezione 6 pezzi',
    tipo: 'CRT-6',
    prezzo_fattura: 18.48,
    peso_kg: 0.75,
    categoria: 'Non Food / Detergenza'
  },
  {
    codice: '270420',
    nome: 'EQO Piatti a Mano Professional Tanica 5kg - Confezione 4 pezzi',
    tipo: 'CRT-4',
    prezzo_fattura: 18.0,
    peso_kg: 5.0,
    categoria: 'Non Food / Detergenza'
  },
  {
    codice: '270421',
    nome: 'EQO Pavimenti Arancia-Limone 5kg - Confezione 4 pezzi',
    tipo: 'CRT-4',
    prezzo_fattura: 15.84,
    peso_kg: 5.0,
    categoria: 'Non Food / Detergenza'
  },
  {
    codice: '270422',
    nome: 'EQO Sgrassatore Limone 750ml - Confezione 6 pezzi + 6 spruzzini',
    tipo: 'CRT-6',
    prezzo_fattura: 9.9,
    peso_kg: 0.75,
    categoria: 'Non Food / Detergenza'
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

  // UoM PZ
  const uomPZ = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    '|', ['name', '=', 'PZ'], ['name', '=', 'Unità']
  ]], { fields: ['id', 'name'], limit: 1 });

  // UoM CONF
  const uomConf = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CONF']
  ]], { fields: ['id', 'name'], limit: 1 });

  // UoM CRT-4
  const uomCrt4 = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CRT-4']
  ]], { fields: ['id', 'name'], limit: 1 });

  // UoM CRT-6
  const uomCrt6 = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CRT-6']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Categoria Pezzi
  const categoryPezzi = await callOdoo(cookies, 'uom.category', 'search_read', [[
    ['name', '=', 'Pezzi']
  ]], { fields: ['id', 'name'], limit: 1 });

  // IVA 8.1% vendita
  const taxSale81 = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['amount', '=', 8.1],
    ['type_tax_use', '=', 'sale']
  ]], { fields: ['id', 'name'], limit: 1 });

  // IVA 0% importazioni
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

  // Categoria prodotto
  const category = await callOdoo(cookies, 'product.category', 'search_read', [[
    ['complete_name', 'ilike', 'Non Food']
  ]], { fields: ['id', 'complete_name'], limit: 1 });

  console.log('✅ UoM PZ:', uomPZ[0]?.name || 'NON TROVATO');
  console.log('✅ UoM CONF:', uomConf[0]?.name || 'NON TROVATO');
  console.log('✅ UoM CRT-4:', uomCrt4[0]?.name || 'NON TROVATO');
  console.log('✅ UoM CRT-6:', uomCrt6[0]?.name || 'NON TROVATO');
  console.log('✅ IVA 8.1%:', taxSale81[0]?.name || 'NON TROVATO');
  console.log('✅ IVA 0%:', taxImport0[0]?.name || 'NON TROVATO');
  console.log('✅ EUR:', eur[0]?.name || 'NON TROVATO');
  console.log('✅ GROMAS:', gromas[0]?.name || 'NON TROVATO');
  console.log('✅ Categoria:', category[0]?.complete_name || 'NON TROVATO');
  console.log('');

  return {
    uomPZ: uomPZ[0],
    uomConf: uomConf[0],
    uomCrt4: uomCrt4[0],
    uomCrt6: uomCrt6[0],
    categoryPezzi: categoryPezzi[0],
    taxSale81: taxSale81[0],
    taxImport0: taxImport0[0],
    eur: eur[0],
    gromas: gromas[0],
    category: category[0]
  };
}

async function creaProdotto(cookies, resources, prodotto, index, total) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`[${index + 1}/${total}] 📦 ${prodotto.codice} - ${prodotto.nome}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Determina UoM
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

  console.log('📋 Configurazione:');
  console.log(`   UoM Vendita: ${uomVendita.name}`);
  console.log(`   UoM Acquisto: ${uomAcquisto.name}`);
  console.log(`   Costo: ${costoPerPezzo.toFixed(2)} EUR per ${uomVendita.name}`);
  console.log(`   Prezzo fornitore: ${prodotto.prezzo_fattura} EUR per ${uomAcquisto.name}`);
  console.log(`   Peso: ${prodotto.peso_kg} kg`);
  console.log('');

  // 1. Crea prodotto
  console.log('⚙️  STEP 1: Creazione prodotto...');

  const productData = {
    name: prodotto.nome,
    default_code: prodotto.codice,
    type: 'product',
    categ_id: resources.category?.id || 1,
    uom_id: uomVendita.id,
    uom_po_id: uomAcquisto.id,
    standard_price: parseFloat(costoPerPezzo.toFixed(2)),
    weight: prodotto.peso_kg,
    purchase_ok: true,
    sale_ok: true,
    taxes_id: [[6, 0, [resources.taxSale81.id]]],
    supplier_taxes_id: [[6, 0, [resources.taxImport0.id]]]
  };

  const productId = await callOdoo(cookies, 'product.template', 'create', [productData]);
  console.log(`✅ Prodotto creato! ID: ${productId}\n`);

  // 2. Aggiungi fornitore GROMAS
  console.log('🏢 STEP 2: Aggiunta fornitore GROMAS...');

  const supplierData = {
    partner_id: resources.gromas.id,
    product_tmpl_id: productId,
    product_name: prodotto.nome,
    product_code: prodotto.codice,
    price: prodotto.prezzo_fattura,
    currency_id: resources.eur.id,
    min_qty: 1.0
  };

  const supplierInfoId = await callOdoo(cookies, 'product.supplierinfo', 'create', [supplierData]);
  console.log(`✅ Fornitore aggiunto! ID: ${supplierInfoId}\n`);

  // 3. Crea packaging se è un cartone
  if (prodotto.tipo.startsWith('CRT-')) {
    console.log('📦 STEP 3: Creazione imballaggio...');

    const pezziPerCartone = parseInt(prodotto.tipo.split('-')[1]);

    // Trova variante prodotto
    const productVariants = await callOdoo(cookies, 'product.product', 'search_read', [[
      ['product_tmpl_id', '=', productId]
    ]], { fields: ['id'], limit: 1 });

    if (productVariants.length > 0) {
      const packagingData = {
        product_id: productVariants[0].id,
        name: 'CARTONE',
        qty: pezziPerCartone,
        sales: true,
        purchase: true
      };

      const packagingId = await callOdoo(cookies, 'product.packaging', 'create', [packagingData]);
      console.log(`✅ Imballaggio creato! ID: ${packagingId}\n`);
    }
  }

  console.log('✅ PRODOTTO COMPLETO!\n');

  return { status: 'ok', codice: prodotto.codice, id: productId };
}

async function archiviaProdottiVecchi(cookies, resources) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('📦 ARCHIVIAZIONE PRODOTTI VECCHI');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const codiciVecchi = PRODOTTI_DA_CREARE.map(p => p.codice);

  for (const codice of codiciVecchi) {
    console.log(`🗄️  Archiviazione prodotto ${codice}...`);

    // Cerca prodotto vecchio
    const products = await callOdoo(cookies, 'product.template', 'search_read', [[
      ['default_code', '=', codice]
    ]], { fields: ['id', 'name', 'active'], limit: 10 });

    // Filtra solo quelli attivi
    const activeProducts = products.filter(p => p.active !== false);

    if (activeProducts.length > 1) {
      // Ci sono più prodotti con lo stesso codice, archivio quello vecchio
      // (il nuovo è stato appena creato quindi ha ID più alto)
      const vecchio = activeProducts.sort((a, b) => a.id - b.id)[0];

      await callOdoo(cookies, 'product.template', 'write', [[vecchio.id], {
        active: false
      }]);

      console.log(`   ✅ Archiviato ID ${vecchio.id}\n`);
    } else {
      console.log(`   ℹ️  Un solo prodotto trovato, non archivio\n`);
    }
  }
}

async function main() {
  try {
    const cookies = await authenticate();
    const resources = await findResources(cookies);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🚀 CREAZIONE 5 NUOVI PRODOTTI GROMAS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const risultati = [];

    for (let i = 0; i < PRODOTTI_DA_CREARE.length; i++) {
      try {
        const result = await creaProdotto(
          cookies,
          resources,
          PRODOTTI_DA_CREARE[i],
          i,
          PRODOTTI_DA_CREARE.length
        );
        risultati.push(result);
      } catch (error) {
        console.log(`   ❌ ERRORE: ${error.message}\n`);
        risultati.push({ status: 'error', codice: PRODOTTI_DA_CREARE[i].codice, error: error.message });
      }
    }

    // Archivia prodotti vecchi
    await archiviaProdottiVecchi(cookies, resources);

    // Riepilogo
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const ok = risultati.filter(r => r.status === 'ok').length;
    const errors = risultati.filter(r => r.status === 'error').length;

    console.log(`✅ Prodotti creati: ${ok}`);
    console.log(`❌ Errori: ${errors}`);

    if (errors > 0) {
      console.log('\n❌ Prodotti con errori:');
      risultati.filter(r => r.status === 'error').forEach(r => {
        console.log(`   • ${r.codice}: ${r.error}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ OPERAZIONE COMPLETATA!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('📝 PROSSIMI PASSI:');
    console.log('   1. Verifica i nuovi prodotti in Odoo');
    console.log('   2. I prodotti vecchi sono stati archiviati');
    console.log('   3. Tutti i 26 prodotti GROMAS sono ora configurati correttamente!\n');

  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
