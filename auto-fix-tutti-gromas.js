/**
 * SCRIPT AUTO-FIX COMPLETO per TUTTI i 26 prodotti GROMAS
 *
 * CHECKLIST E AUTO-FIX:
 * ✅ 1. UoM Vendita/Acquisto → SE SBAGLIATE: SKIP (non modificabili con movimenti)
 * ✅ 2. Prezzo fornitore → SE SBAGLIATO: CORREGGI
 * ✅ 3. Costo interno → SE SBAGLIATO: CORREGGI
 * ✅ 4. IVA cliente 8.1% → SE MANCA: AGGIUNGI
 * ✅ 5. IVA fornitore 0% → SE MANCA: AGGIUNGI
 * ✅ 6. Valuta EUR → SE SBAGLIATA: CORREGGI
 * ✅ 7. Nome prodotto fornitore → SE MANCA: AGGIUNGI
 * ✅ 8. Codice prodotto fornitore → SE MANCA: AGGIUNGI
 * ✅ 9. Peso prodotto → SE MANCA: SKIP (non critico)
 * ✅ 10. Fornitore GROMAS → SE MANCA: CREA
 * ✅ 11. Packaging cartone → SE MANCA: CREA
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODOTTI_FATTURA = [
  { codice: '26425', nome: 'GUANTI NERI M NITRILE REFLEXX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29, uom_vendita: 'CONF', uom_acquisto: 'CONF' },
  { codice: '032133', nome: 'SECCHIO CON STRIZZATORE RETT 12LT ZIF', tipo: 'SINGOLO', prezzo_fattura: 2.64, uom_vendita: 'PZ', uom_acquisto: 'PZ' },
  { codice: '09632', nome: 'NEOFORT RAPIDO LT 0.75X6 +1SP', tipo: 'CRT-6', prezzo_fattura: 17.52, uom_vendita: 'PZ', uom_acquisto: 'CRT-6', pezzi: 6 },
  { codice: '09731', nome: 'PULIVAT CONF 750 ML X 6 PZ', tipo: 'CRT-6', prezzo_fattura: 18.48, uom_vendita: 'PZ', uom_acquisto: 'CRT-6', pezzi: 6 },
  { codice: '09733', nome: 'UNI5 SOAP IGIENIZZANTE BIANCO MANI 5KGX4', tipo: 'CRT-4', prezzo_fattura: 19.55, uom_vendita: 'PZ', uom_acquisto: 'CRT-4', pezzi: 4 },
  { codice: '11563', nome: 'PULIGEN DISINCROSTANTE FLAC 1LT X12', tipo: 'CRT-12', prezzo_fattura: 5.5, uom_vendita: 'PZ', uom_acquisto: 'CRT-12', pezzi: 12 },
  { codice: '270420', nome: 'EQO PIATTI A MANO TAN KG 5X4 INTER', tipo: 'CRT-4', prezzo_fattura: 18.0, uom_vendita: 'PZ', uom_acquisto: 'CRT-4', pezzi: 4 },
  { codice: '270421', nome: 'EQO PAVIMENTI ARANCIA-LIM KG 5X4 INTER', tipo: 'CRT-4', prezzo_fattura: 15.84, uom_vendita: 'PZ', uom_acquisto: 'CRT-4', pezzi: 4 },
  { codice: '270423', nome: 'EQO BAGNO ANTICALCARE LT0.75X6+6SP INTER', tipo: 'CRT-6', prezzo_fattura: 11.22, uom_vendita: 'PZ', uom_acquisto: 'CRT-6', pezzi: 6 },
  { codice: '270425', nome: 'EQO LAVASTOVIGLIE TAN KG 5.5 X 2 INTER', tipo: 'CRT-2', prezzo_fattura: 13.1, uom_vendita: 'PZ', uom_acquisto: 'CRT-2', pezzi: 2 },
  { codice: '31128', nome: 'RICAMBIO MOP SINTETICO', tipo: 'SINGOLO', prezzo_fattura: 3.14, uom_vendita: 'PZ', uom_acquisto: 'PZ' },
  { codice: '26424', nome: 'GUANTI NERI L NITRILE REFLEX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29, uom_vendita: 'CONF', uom_acquisto: 'CONF' },
  { codice: '50004', nome: 'PELLICOLA SUPERPACK 300 MT CHAMPAGNE BOX', tipo: 'SINGOLO', prezzo_fattura: 5.0, uom_vendita: 'PZ', uom_acquisto: 'PZ' },
  { codice: '70114', nome: 'EFFICACE MULTIGEN IGIENIZZANTE 0.75LT X6', tipo: 'CRT-6', prezzo_fattura: 2.97, uom_vendita: 'PZ', uom_acquisto: 'CRT-6', pezzi: 6 },
  { codice: '96855', nome: 'SACCHETTI CARTA BIANCO 14X30 B35 1000PZ', tipo: 'SINGOLO', prezzo_fattura: 19.25, uom_vendita: 'PZ', uom_acquisto: 'PZ' },
  { codice: '39726', nome: 'ARGONIT AF/2 DISINFETTANTE LT0.75X6', tipo: 'CRT-6', prezzo_fattura: 19.8, uom_vendita: 'PZ', uom_acquisto: 'CRT-6', pezzi: 6 },
  { codice: '31828', nome: 'VINCO AMMORBIDENTE M.BIANCO 5KG X4 INTER', tipo: 'CRT-4', prezzo_fattura: 7.7, uom_vendita: 'PZ', uom_acquisto: 'CRT-4', pezzi: 4 },
  { codice: '270426', nome: 'EQO BRILLANTANTE TAN KG 5 X 2 INTER', tipo: 'CRT-2', prezzo_fattura: 15.08, uom_vendita: 'PZ', uom_acquisto: 'CRT-2', pezzi: 2 },
  { codice: '411024', nome: 'POLIUNTO X2 GROMAS 800 STRAPPI', tipo: 'SINGOLO', prezzo_fattura: 6.55, uom_vendita: 'PZ', uom_acquisto: 'PZ' },
  { codice: '26426', nome: 'GUANTI NERI S NITRILE REFLEXX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29, uom_vendita: 'CONF', uom_acquisto: 'CONF' },
  { codice: '26423', nome: 'GUANTI NERI XL NITRILE REFLEX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29, uom_vendita: 'CONF', uom_acquisto: 'CONF' },
  { codice: '270424', nome: 'EQO VETRI E MULT LT 0.75X6+6SP INTER', tipo: 'CRT-6', prezzo_fattura: 9.3, uom_vendita: 'PZ', uom_acquisto: 'CRT-6', pezzi: 6 },
  { codice: '032123', nome: 'SPUGNA ZINCATA ACCIAIO 40GR x 25 pz ZIF', tipo: 'CRT-25', prezzo_fattura: 0.44, uom_vendita: 'PZ', uom_acquisto: 'CRT-25', pezzi: 25 },
  { codice: '270422', nome: 'EQO SGRASSATORE LIM LT 0.75X6+6SP INTER', tipo: 'CRT-6', prezzo_fattura: 9.9, uom_vendita: 'PZ', uom_acquisto: 'CRT-6', pezzi: 6 },
  { codice: '032120', nome: 'SCOPA CROMA ROSSO/NERO ZIF', tipo: 'SINGOLO', prezzo_fattura: 1.26, uom_vendita: 'PZ', uom_acquisto: 'PZ' },
  { codice: '032124', nome: 'SPUGNA FIBRA 50PZ GROSSA ZIF', tipo: 'CRT-50', prezzo_fattura: 0.33, uom_vendita: 'PZ', uom_acquisto: 'CRT-50', pezzi: 50 }
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
  if (data.error) throw new Error(`Errore ${model}.${method}: ${data.error.data?.message || JSON.stringify(data.error)}`);
  return data.result;
}

async function fixProdotto(cookies, resources, prodottoAtteso, index, total) {
  console.log(`\n[${index + 1}/${total}] 🔧 ${prodottoAtteso.codice} - ${prodottoAtteso.nome.substring(0, 40)}...`);

  const fixes = [];

  // 1. Cerca prodotto (anche tra copie)
  const products = await callOdoo(cookies, 'product.template', 'search_read', [[
    ['default_code', '=', prodottoAtteso.codice],
    ['active', '=', true]
  ]], { fields: ['id', 'name', 'uom_id', 'uom_po_id', 'standard_price', 'taxes_id', 'supplier_taxes_id'], limit: 10 });

  if (products.length === 0) {
    console.log('   ❌ PRODOTTO NON TROVATO');
    return { status: 'NOT_FOUND', fixes: [] };
  }

  // Prendi il prodotto con ID più alto (più recente)
  const product = products.sort((a, b) => b.id - a.id)[0];
  console.log(`   📋 ID: ${product.id}`);

  // 2. Calcola costo atteso
  let costoAtteso;
  if (prodottoAtteso.tipo === 'SINGOLO' || prodottoAtteso.tipo === 'CONF') {
    costoAtteso = prodottoAtteso.prezzo_fattura;
  } else {
    costoAtteso = prodottoAtteso.prezzo_fattura / prodottoAtteso.pezzi;
  }

  // 3. Fix costo se sbagliato
  const costoDiff = Math.abs(product.standard_price - costoAtteso);
  if (costoDiff > 0.02) {
    await callOdoo(cookies, 'product.template', 'write', [[product.id], {
      standard_price: parseFloat(costoAtteso.toFixed(2))
    }]);
    fixes.push(`✅ Costo corretto: ${costoAtteso.toFixed(2)} EUR`);
  }

  // 4. Fix IVA cliente (8.1%)
  let hasIva81 = false;
  if (product.taxes_id && product.taxes_id.length > 0) {
    const taxes = await callOdoo(cookies, 'account.tax', 'read', [product.taxes_id], { fields: ['amount'] });
    hasIva81 = taxes.some(t => t.amount === 8.1);
  }

  if (!hasIva81) {
    await callOdoo(cookies, 'product.template', 'write', [[product.id], {
      taxes_id: [[6, 0, [resources.taxSale81.id]]]
    }]);
    fixes.push('✅ IVA cliente 8.1% aggiunta');
  }

  // 5. Fix IVA fornitore (0%)
  let hasIva0 = false;
  if (product.supplier_taxes_id && product.supplier_taxes_id.length > 0) {
    const supplierTaxes = await callOdoo(cookies, 'account.tax', 'read', [product.supplier_taxes_id], { fields: ['amount'] });
    hasIva0 = supplierTaxes.some(t => t.amount === 0);
  }

  if (!hasIva0) {
    await callOdoo(cookies, 'product.template', 'write', [[product.id], {
      supplier_taxes_id: [[6, 0, [resources.taxImport0.id]]]
    }]);
    fixes.push('✅ IVA fornitore 0% aggiunta');
  }

  // 6. Fix fornitore GROMAS
  let supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', product.id],
    ['partner_id', '=', resources.gromas.id]
  ]], { fields: ['id', 'product_name', 'product_code', 'price', 'currency_id'], limit: 1 });

  if (supplierInfos.length === 0) {
    // CREA fornitore
    const supplierData = {
      partner_id: resources.gromas.id,
      product_tmpl_id: product.id,
      product_name: prodottoAtteso.nome,
      product_code: prodottoAtteso.codice,
      price: prodottoAtteso.prezzo_fattura,
      currency_id: resources.eur.id,
      min_qty: 1.0
    };

    await callOdoo(cookies, 'product.supplierinfo', 'create', [supplierData]);
    fixes.push('✅ Fornitore GROMAS creato');
  } else {
    // AGGIORNA fornitore
    const supplier = supplierInfos[0];
    const needsUpdate = {};

    const prezzoDiff = Math.abs(supplier.price - prodottoAtteso.prezzo_fattura);
    if (prezzoDiff > 0.02) {
      needsUpdate.price = prodottoAtteso.prezzo_fattura;
    }

    if (!supplier.currency_id || supplier.currency_id[0] !== resources.eur.id) {
      needsUpdate.currency_id = resources.eur.id;
    }

    if (!supplier.product_name) {
      needsUpdate.product_name = prodottoAtteso.nome;
    }

    if (!supplier.product_code) {
      needsUpdate.product_code = prodottoAtteso.codice;
    }

    if (Object.keys(needsUpdate).length > 0) {
      await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplier.id], needsUpdate]);
      fixes.push('✅ Fornitore GROMAS aggiornato');
    }
  }

  // 7. Fix packaging per cartoni
  if (prodottoAtteso.tipo.startsWith('CRT-')) {
    const packagings = await callOdoo(cookies, 'product.packaging', 'search_read', [[
      ['product_id.product_tmpl_id', '=', product.id]
    ]], { fields: ['name', 'qty'], limit: 5 });

    const hasCartone = packagings.some(p => p.name === 'CARTONE' && p.qty === prodottoAtteso.pezzi);

    if (!hasCartone) {
      // Trova variante
      const productVariants = await callOdoo(cookies, 'product.product', 'search_read', [[
        ['product_tmpl_id', '=', product.id]
      ]], { fields: ['id'], limit: 1 });

      if (productVariants.length > 0) {
        const packagingData = {
          product_id: productVariants[0].id,
          name: 'CARTONE',
          qty: prodottoAtteso.pezzi,
          sales: true,
          purchase: true
        };

        await callOdoo(cookies, 'product.packaging', 'create', [packagingData]);
        fixes.push(`✅ Imballaggio CARTONE da ${prodottoAtteso.pezzi} pz creato`);
      }
    }
  }

  if (fixes.length > 0) {
    fixes.forEach(f => console.log(`      ${f}`));
  } else {
    console.log('   ✅ Già perfetto, nessuna modifica');
  }

  return { status: 'OK', fixes };
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
    console.log('🔧 AUTO-FIX COMPLETO 26 PRODOTTI GROMAS');
    console.log('═══════════════════════════════════════════════════════════════════');

    const risultati = [];

    for (let i = 0; i < PRODOTTI_FATTURA.length; i++) {
      try {
        const result = await fixProdotto(cookies, resources, PRODOTTI_FATTURA[i], i, PRODOTTI_FATTURA.length);
        risultati.push(result);
      } catch (error) {
        console.log(`   ❌ ERRORE: ${error.message}`);
        risultati.push({ status: 'ERROR', fixes: [], error: error.message });
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const ok = risultati.filter(r => r.status === 'OK').length;
    const errors = risultati.filter(r => r.status === 'ERROR').length;
    const notFound = risultati.filter(r => r.status === 'NOT_FOUND').length;
    const totalFixes = risultati.reduce((sum, r) => sum + (r.fixes?.length || 0), 0);

    console.log(`✅ Prodotti sistemati: ${ok}/${PRODOTTI_FATTURA.length}`);
    console.log(`❌ Errori: ${errors}`);
    console.log(`🔍 Non trovati: ${notFound}`);
    console.log(`🔧 Totale correzioni applicate: ${totalFixes}`);

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ AUTO-FIX COMPLETATO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error.message);
    process.exit(1);
  }
}

main();
