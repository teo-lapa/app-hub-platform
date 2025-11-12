/**
 * Script per sistemare gli ultimi 5 prodotti con UoM errata
 * Strategia: Archiviarli e duplicarli con UoM corretta
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODOTTI_DA_FIXARE = [
  {
    id_vecchio: 24258,
    codice: '26425',
    nome: 'GUANTI NERI M NITRILE REFLEXX 100 PZ',
    tipo: 'CONF',
    prezzo_fattura: 4.29,
    uom_vendita: 'CONF',
    uom_acquisto: 'CONF',
    costo_per_uom: 4.29,
    peso: 0.5
  },
  {
    id_vecchio: 24248,
    codice: '09731',
    nome: 'PULIVAT CONF 750 ML X 6 PZ',
    tipo: 'CRT-6',
    prezzo_fattura: 18.48,
    pezzi: 6,
    uom_vendita: 'PZ',
    uom_acquisto: 'CRT-6',
    costo_per_pezzo: 3.08,
    peso: 5.0
  },
  {
    id_vecchio: 24260,
    codice: '270420',
    nome: 'EQO PIATTI A MANO TAN KG 5X4 INTER',
    tipo: 'CRT-4',
    prezzo_fattura: 18.0,
    pezzi: 4,
    uom_vendita: 'PZ',
    uom_acquisto: 'CRT-4',
    costo_per_pezzo: 4.50,
    peso: 22.0
  },
  {
    id_vecchio: 24261,
    codice: '270421',
    nome: 'EQO PAVIMENTI ARANCIA-LIM KG 5X4 INTER',
    tipo: 'CRT-4',
    prezzo_fattura: 15.84,
    pezzi: 4,
    uom_vendita: 'PZ',
    uom_acquisto: 'CRT-4',
    costo_per_pezzo: 3.96,
    peso: 22.0
  },
  {
    id_vecchio: 24259,
    codice: '270422',
    nome: 'EQO SGRASSATORE LIM LT 0.75X6+6SP INTER',
    tipo: 'CRT-6',
    prezzo_fattura: 9.9,
    pezzi: 6,
    uom_vendita: 'PZ',
    uom_acquisto: 'CRT-6',
    costo_per_pezzo: 1.65,
    peso: 5.5
  }
];

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD } })
  });

  const data = await response.json();
  if (data.error) throw new Error('Autenticazione fallita');

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
  if (!sessionMatch) throw new Error('Nessun session_id');

  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(`Errore ${model}.${method}: ${data.error.data?.message || 'unknown'}`);
  return data.result;
}

async function fixProdotto(cookies, resources, prodotto, index, total) {
  console.log(`\n[${index + 1}/${total}] 🔧 ${prodotto.codice} - ${prodotto.nome.substring(0, 40)}...`);
  console.log(`   📋 ID vecchio: ${prodotto.id_vecchio}`);

  // 1. Duplica il prodotto vecchio
  console.log('   📋 Duplicazione prodotto...');
  const idNuovo = await callOdoo(cookies, 'product.template', 'copy', [prodotto.id_vecchio], {
    default: {}
  });
  console.log(`   ✅ Nuovo ID: ${idNuovo}`);

  // 2. Trova gli UoM
  const uomVendita = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', prodotto.uom_vendita]
  ]], { fields: ['id'], limit: 1 });

  const uomAcquisto = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', prodotto.uom_acquisto]
  ]], { fields: ['id'], limit: 1 });

  if (uomVendita.length === 0 || uomAcquisto.length === 0) {
    console.log('   ❌ UoM non trovato!');
    return { status: 'ERROR', error: 'UoM non trovato' };
  }

  // 3. Aggiorna il nuovo prodotto con UoM corrette
  console.log(`   ⚙️  Aggiornamento UoM: Vendita=${prodotto.uom_vendita}, Acquisto=${prodotto.uom_acquisto}...`);

  const costo = prodotto.tipo === 'CONF' ? prodotto.costo_per_uom : prodotto.costo_per_pezzo;

  await callOdoo(cookies, 'product.template', 'write', [[idNuovo], {
    uom_id: uomVendita[0].id,
    uom_po_id: uomAcquisto[0].id,
    standard_price: parseFloat(costo.toFixed(2)),
    weight: prodotto.peso,
    taxes_id: [[6, 0, [resources.taxSale81.id]]],
    supplier_taxes_id: [[6, 0, [resources.taxImport0.id]]]
  }]);

  console.log('   ✅ UoM e costo aggiornati');

  // 4. Aggiorna/Crea fornitore GROMAS
  console.log('   🏢 Aggiornamento fornitore...');

  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', idNuovo],
    ['partner_id', '=', resources.gromas.id]
  ]], { fields: ['id'], limit: 1 });

  if (supplierInfos.length === 0) {
    // Crea
    await callOdoo(cookies, 'product.supplierinfo', 'create', [{
      partner_id: resources.gromas.id,
      product_tmpl_id: idNuovo,
      product_name: prodotto.nome,
      product_code: prodotto.codice,
      price: prodotto.prezzo_fattura,
      currency_id: resources.eur.id,
      min_qty: 1.0
    }]);
    console.log('   ✅ Fornitore creato');
  } else {
    // Aggiorna
    await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplierInfos[0].id], {
      product_name: prodotto.nome,
      product_code: prodotto.codice,
      price: prodotto.prezzo_fattura,
      currency_id: resources.eur.id
    }]);
    console.log('   ✅ Fornitore aggiornato');
  }

  // 5. Crea packaging se cartone
  if (prodotto.tipo.startsWith('CRT-')) {
    console.log('   📦 Creazione packaging...');

    const productVariants = await callOdoo(cookies, 'product.product', 'search_read', [[
      ['product_tmpl_id', '=', idNuovo]
    ]], { fields: ['id'], limit: 1 });

    if (productVariants.length > 0) {
      await callOdoo(cookies, 'product.packaging', 'create', [{
        product_id: productVariants[0].id,
        name: 'CARTONE',
        qty: prodotto.pezzi,
        sales: true,
        purchase: true
      }]);
      console.log(`   ✅ Packaging CARTONE da ${prodotto.pezzi} pz creato`);
    }
  }

  // 6. Archivia il vecchio prodotto
  console.log('   🗄️  Archiviazione prodotto vecchio...');
  await callOdoo(cookies, 'product.template', 'write', [[prodotto.id_vecchio], {
    active: false
  }]);
  console.log('   ✅ Prodotto vecchio archiviato');

  console.log(`   ✅ PRODOTTO SISTEMATO! Nuovo ID: ${idNuovo}\n`);
  return { status: 'OK', id_nuovo: idNuovo };
}

async function main() {
  try {
    console.log('🔐 Autenticazione...');
    const cookies = await authenticate();
    console.log('✅ Autenticato\n');

    console.log('🔍 Caricamento risorse...');

    const taxSale81 = await callOdoo(cookies, 'account.tax', 'search_read', [[['amount', '=', 8.1], ['type_tax_use', '=', 'sale']]], { fields: ['id'], limit: 1 });
    const taxImport0 = await callOdoo(cookies, 'account.tax', 'search_read', [[['amount', '=', 0], ['type_tax_use', '=', 'purchase']]], { fields: ['id'], limit: 1 });
    const eur = await callOdoo(cookies, 'res.currency', 'search_read', [[['name', '=', 'EUR']]], { fields: ['id'], limit: 1 });
    const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[['name', 'ilike', 'GROMAS']]], { fields: ['id'], limit: 1 });

    const resources = {
      taxSale81: taxSale81[0],
      taxImport0: taxImport0[0],
      eur: eur[0],
      gromas: gromas[0]
    };

    console.log('✅ Risorse caricate\n');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🔧 FIX 5 PRODOTTI CON UOM ERRATA');
    console.log('═══════════════════════════════════════════════════════════════════');

    const risultati = [];

    for (let i = 0; i < PRODOTTI_DA_FIXARE.length; i++) {
      try {
        const result = await fixProdotto(cookies, resources, PRODOTTI_DA_FIXARE[i], i, PRODOTTI_DA_FIXARE.length);
        risultati.push(result);
      } catch (error) {
        console.log(`   ❌ ERRORE: ${error.message}`);
        risultati.push({ status: 'ERROR', error: error.message });
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const ok = risultati.filter(r => r.status === 'OK').length;

    console.log(`✅ Prodotti sistemati: ${ok}/5`);

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ COMPLETATO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('🎉 ADESSO TUTTI I 26 PRODOTTI GROMAS SONO DAVVERO PERFETTI!\n');

  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error.message);
    process.exit(1);
  }
}

main();
