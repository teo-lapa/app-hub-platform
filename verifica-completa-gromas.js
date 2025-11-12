/**
 * SCRIPT DI VERIFICA COMPLETA per TUTTI i 26 prodotti GROMAS
 *
 * CHECKLIST COMPLETA PER OGNI PRODOTTO:
 * ✅ 1. UoM Vendita corretta (PZ per cartoni, CONF per guanti, PZ per singoli)
 * ✅ 2. UoM Acquisto corretta (CRT-X per cartoni, CONF per guanti, PZ per singoli)
 * ✅ 3. Prezzo fornitore corretto (per cartone/conf, come da fattura)
 * ✅ 4. Costo interno corretto (per pezzo/conf)
 * ✅ 5. Imposte cliente: IVA 8.1%
 * ✅ 6. Imposte fornitore: IVA 0% importazioni
 * ✅ 7. Valuta: EUR
 * ✅ 8. Nome prodotto fornitore
 * ✅ 9. Codice prodotto fornitore
 * ✅ 10. Peso prodotto
 * ✅ 11. Packaging (imballaggio) per prodotti in cartone
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// TUTTI i 26 prodotti dalla fattura con configurazione ATTESA
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
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD }
    })
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
  if (data.error) throw new Error(`Errore ${model}.${method}`);
  return data.result;
}

async function verificaProdotto(cookies, gromasId, prodottoAtteso, index, total) {
  console.log(`\n[${ index + 1}/${total}] 🔍 ${prodottoAtteso.codice} - ${prodottoAtteso.nome.substring(0, 50)}...`);

  const errori = [];
  const warnings = [];

  // 1. Cerca prodotto
  const products = await callOdoo(cookies, 'product.template', 'search_read', [[
    ['default_code', '=', prodottoAtteso.codice],
    ['active', '=', true]
  ]], { fields: ['id', 'name', 'uom_id', 'uom_po_id', 'standard_price', 'taxes_id', 'supplier_taxes_id', 'weight'], limit: 1 });

  if (products.length === 0) {
    errori.push('❌ PRODOTTO NON TROVATO');
    return { codice: prodottoAtteso.codice, errori, warnings, status: 'NOT_FOUND' };
  }

  const product = products[0];

  // 2. Verifica UoM Vendita
  const uomVenditaNome = product.uom_id[1];
  if (!uomVenditaNome.includes(prodottoAtteso.uom_vendita)) {
    errori.push(`❌ UoM Vendita: ${uomVenditaNome} (atteso: ${prodottoAtteso.uom_vendita})`);
  }

  // 3. Verifica UoM Acquisto
  const uomAcquistoNome = product.uom_po_id[1];
  if (!uomAcquistoNome.includes(prodottoAtteso.uom_acquisto)) {
    errori.push(`❌ UoM Acquisto: ${uomAcquistoNome} (atteso: ${prodottoAtteso.uom_acquisto})`);
  }

  // 4. Calcola costo atteso
  let costoAtteso;
  if (prodottoAtteso.tipo === 'SINGOLO' || prodottoAtteso.tipo === 'CONF') {
    costoAtteso = prodottoAtteso.prezzo_fattura;
  } else {
    costoAtteso = prodottoAtteso.prezzo_fattura / prodottoAtteso.pezzi;
  }

  const costoDifferenza = Math.abs(product.standard_price - costoAtteso);
  if (costoDifferenza > 0.02) {
    errori.push(`❌ Costo: ${product.standard_price.toFixed(2)} EUR (atteso: ${costoAtteso.toFixed(2)} EUR)`);
  }

  // 5. Verifica imposte cliente (IVA 8.1%)
  if (product.taxes_id && product.taxes_id.length > 0) {
    const taxes = await callOdoo(cookies, 'account.tax', 'read', [product.taxes_id], { fields: ['name', 'amount'] });
    const hasIva81 = taxes.some(t => t.amount === 8.1);
    if (!hasIva81) {
      errori.push(`❌ IVA cliente: non ha 8.1% (ha: ${taxes.map(t => t.amount + '%').join(', ')})`);
    }
  } else {
    errori.push('❌ IVA cliente: nessuna imposta');
  }

  // 6. Verifica imposte fornitore (IVA 0%)
  if (product.supplier_taxes_id && product.supplier_taxes_id.length > 0) {
    const supplierTaxes = await callOdoo(cookies, 'account.tax', 'read', [product.supplier_taxes_id], { fields: ['name', 'amount'] });
    const hasIva0 = supplierTaxes.some(t => t.amount === 0);
    if (!hasIva0) {
      errori.push(`❌ IVA fornitore: non ha 0% (ha: ${supplierTaxes.map(t => t.amount + '%').join(', ')})`);
    }
  } else {
    warnings.push('⚠️  IVA fornitore: nessuna imposta');
  }

  // 7. Verifica peso
  if (!product.weight || product.weight === 0) {
    warnings.push('⚠️  Peso: non impostato');
  }

  // 8. Verifica fornitore
  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', product.id],
    ['partner_id', '=', gromasId]
  ]], { fields: ['product_name', 'product_code', 'price', 'currency_id'], limit: 1 });

  if (supplierInfos.length === 0) {
    errori.push('❌ Fornitore GROMAS non trovato');
  } else {
    const supplier = supplierInfos[0];

    // Verifica prezzo fornitore
    const prezzoDifferenza = Math.abs(supplier.price - prodottoAtteso.prezzo_fattura);
    if (prezzoDifferenza > 0.02) {
      errori.push(`❌ Prezzo fornitore: ${supplier.price} EUR (atteso: ${prodottoAtteso.prezzo_fattura} EUR)`);
    }

    // Verifica valuta
    if (!supplier.currency_id || supplier.currency_id[1] !== 'EUR') {
      errori.push(`❌ Valuta: ${supplier.currency_id ? supplier.currency_id[1] : 'N/A'} (atteso: EUR)`);
    }

    // Verifica nome/codice fornitore
    if (!supplier.product_name) {
      warnings.push('⚠️  Nome prodotto fornitore: non impostato');
    }
    if (!supplier.product_code) {
      warnings.push('⚠️  Codice prodotto fornitore: non impostato');
    }
  }

  // 9. Verifica packaging per prodotti in cartone
  if (prodottoAtteso.tipo.startsWith('CRT-')) {
    const packagings = await callOdoo(cookies, 'product.packaging', 'search_read', [[
      ['product_id.product_tmpl_id', '=', product.id]
    ]], { fields: ['name', 'qty'], limit: 5 });

    if (packagings.length === 0) {
      warnings.push('⚠️  Imballaggio: non creato');
    } else {
      const hasCartone = packagings.some(p => p.name === 'CARTONE' && p.qty === prodottoAtteso.pezzi);
      if (!hasCartone) {
        warnings.push(`⚠️  Imballaggio: non corretto (atteso: CARTONE da ${prodottoAtteso.pezzi} pz)`);
      }
    }
  }

  // Mostra risultato
  if (errori.length === 0 && warnings.length === 0) {
    console.log('   ✅ PERFETTO - Tutto OK!');
  } else {
    if (errori.length > 0) {
      console.log('   ERRORI:');
      errori.forEach(e => console.log(`      ${e}`));
    }
    if (warnings.length > 0) {
      console.log('   WARNINGS:');
      warnings.forEach(w => console.log(`      ${w}`));
    }
  }

  return {
    codice: prodottoAtteso.codice,
    id: product.id,
    errori,
    warnings,
    status: errori.length === 0 ? (warnings.length === 0 ? 'OK' : 'WARNING') : 'ERROR'
  };
}

async function main() {
  try {
    console.log('🔐 Autenticazione...');
    const cookies = await authenticate();
    console.log('✅ Autenticato\n');

    // Trova GROMAS
    const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
      ['name', 'ilike', 'GROMAS']
    ]], { fields: ['id'], limit: 1 });

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📋 VERIFICA COMPLETA 26 PRODOTTI GROMAS');
    console.log('═══════════════════════════════════════════════════════════════════');

    const risultati = [];

    for (let i = 0; i < PRODOTTI_FATTURA.length; i++) {
      try {
        const result = await verificaProdotto(cookies, gromas[0].id, PRODOTTI_FATTURA[i], i, PRODOTTI_FATTURA.length);
        risultati.push(result);
      } catch (error) {
        console.log(`   ❌ ERRORE: ${error.message}`);
        risultati.push({ codice: PRODOTTI_FATTURA[i].codice, errori: ['ERRORE VERIFICA'], status: 'ERROR' });
      }
    }

    // RIEPILOGO FINALE
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const ok = risultati.filter(r => r.status === 'OK').length;
    const warnings = risultati.filter(r => r.status === 'WARNING').length;
    const errors = risultati.filter(r => r.status === 'ERROR').length;
    const notFound = risultati.filter(r => r.status === 'NOT_FOUND').length;

    console.log(`✅ Perfetti (OK): ${ok}/${PRODOTTI_FATTURA.length}`);
    console.log(`⚠️  Con warnings: ${warnings}/${PRODOTTI_FATTURA.length}`);
    console.log(`❌ Con errori: ${errors}/${PRODOTTI_FATTURA.length}`);
    console.log(`🔍 Non trovati: ${notFound}/${PRODOTTI_FATTURA.length}`);

    if (errors > 0) {
      console.log('\n❌ PRODOTTI CON ERRORI:');
      risultati.filter(r => r.status === 'ERROR').forEach(r => {
        console.log(`\n   ${r.codice}:`);
        r.errori.forEach(e => console.log(`      ${e}`));
      });
    }

    if (warnings > 0) {
      console.log('\n⚠️  PRODOTTI CON WARNINGS:');
      risultati.filter(r => r.status === 'WARNING').forEach(r => {
        console.log(`\n   ${r.codice}:`);
        r.warnings.forEach(w => console.log(`      ${w}`));
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ VERIFICA COMPLETATA');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error.message);
    process.exit(1);
  }
}

main();
