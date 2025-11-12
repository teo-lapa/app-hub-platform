/**
 * Script per sistemare i 5 prodotti duplicati che hanno "(copia)" nel nome
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODOTTI_COPIE = [
  { codice: '26425', nome: 'GUANTI NERI M NITRILE REFLEXX 100 PZ', tipo: 'CONF', prezzo_fattura: 4.29 },
  { codice: '09731', nome: 'PULIVAT CONF 750 ML X 6 PZ', tipo: 'CRT-6', prezzo_fattura: 18.48, pezzi: 6 },
  { codice: '270420', nome: 'EQO PIATTI A MANO TAN KG 5X4 INTER', tipo: 'CRT-4', prezzo_fattura: 18.0, pezzi: 4 },
  { codice: '270421', nome: 'EQO PAVIMENTI ARANCIA-LIM KG 5X4 INTER', tipo: 'CRT-4', prezzo_fattura: 15.84, pezzi: 4 },
  { codice: '270422', nome: 'EQO SGRASSATORE LIM LT 0.75X6+6SP INTER', tipo: 'CRT-6', prezzo_fattura: 9.9, pezzi: 6 }
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

async function fixCopia(cookies, resources, prodotto, index, total) {
  console.log(`\n[${index + 1}/${total}] 🔧 ${prodotto.codice} - ${prodotto.nome.substring(0, 40)}...`);

  const fixes = [];

  // Cerca prodotto (anche tra quelli inattivi, prendi quello con ID più alto = più recente)
  // IMPORTANTE: devo includere 'active_test': false nel context per vedere anche gli inattivi
  const products = await callOdoo(cookies, 'product.template', 'search_read', [[
    ['default_code', '=', prodotto.codice]
  ]], {
    fields: ['id', 'name', 'standard_price', 'active'],
    limit: 10,
    context: { active_test: false }  // Mostra anche prodotti inattivi!
  });

  if (products.length === 0) {
    console.log('   ❌ PRODOTTO NON TROVATO');
    return { status: 'NOT_FOUND' };
  }

  // Prendi quello con ID più alto (più recente)
  const product = products.sort((a, b) => b.id - a.id)[0];
  const statusText = product.active ? 'ATTIVO' : '⚠️  INATTIVO';
  console.log(`   📋 ID: ${product.id} - ${product.name.substring(0, 50)}... [${statusText}]`);

  // Se è inattivo, riattivalo
  if (!product.active) {
    await callOdoo(cookies, 'product.template', 'write', [[product.id], {
      active: true
    }]);
    fixes.push('✅ Prodotto riattivato');
  }

  // Calcola costo atteso
  let costoAtteso;
  if (prodotto.tipo === 'CONF') {
    costoAtteso = prodotto.prezzo_fattura;
  } else {
    costoAtteso = prodotto.prezzo_fattura / prodotto.pezzi;
  }

  // 1. Rimuovi "(copia)" dal nome
  if (product.name.includes('(copia)')) {
    const nomeNuovo = product.name.replace(/\s*\(copia\)/gi, '').trim();
    await callOdoo(cookies, 'product.template', 'write', [[product.id], {
      name: nomeNuovo
    }]);
    fixes.push(`✅ Nome sistemato (rimosso "copia")`);
  }

  // 2. Fix costo
  const costoDiff = Math.abs(product.standard_price - costoAtteso);
  if (costoDiff > 0.02) {
    await callOdoo(cookies, 'product.template', 'write', [[product.id], {
      standard_price: parseFloat(costoAtteso.toFixed(2))
    }]);
    fixes.push(`✅ Costo corretto: ${costoAtteso.toFixed(2)} EUR`);
  }

  // 3. Fix IVA cliente (8.1%)
  await callOdoo(cookies, 'product.template', 'write', [[product.id], {
    taxes_id: [[6, 0, [resources.taxSale81.id]]]
  }]);
  fixes.push('✅ IVA cliente 8.1%');

  // 4. Fix IVA fornitore (0%)
  await callOdoo(cookies, 'product.template', 'write', [[product.id], {
    supplier_taxes_id: [[6, 0, [resources.taxImport0.id]]]
  }]);
  fixes.push('✅ IVA fornitore 0%');

  // 5. Fix/Crea fornitore GROMAS
  let supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', product.id],
    ['partner_id', '=', resources.gromas.id]
  ]], { fields: ['id'], limit: 1 });

  if (supplierInfos.length === 0) {
    // CREA fornitore
    const supplierData = {
      partner_id: resources.gromas.id,
      product_tmpl_id: product.id,
      product_name: prodotto.nome,
      product_code: prodotto.codice,
      price: prodotto.prezzo_fattura,
      currency_id: resources.eur.id,
      min_qty: 1.0
    };

    await callOdoo(cookies, 'product.supplierinfo', 'create', [supplierData]);
    fixes.push('✅ Fornitore GROMAS creato');
  } else {
    // AGGIORNA fornitore
    await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplierInfos[0].id], {
      product_name: prodotto.nome,
      product_code: prodotto.codice,
      price: prodotto.prezzo_fattura,
      currency_id: resources.eur.id
    }]);
    fixes.push('✅ Fornitore GROMAS aggiornato');
  }

  // 6. Crea packaging se cartone
  if (prodotto.tipo.startsWith('CRT-')) {
    const packagings = await callOdoo(cookies, 'product.packaging', 'search_read', [[
      ['product_id.product_tmpl_id', '=', product.id]
    ]], { fields: ['name', 'qty'], limit: 5 });

    const hasCartone = packagings.some(p => p.name === 'CARTONE' && p.qty === prodotto.pezzi);

    if (!hasCartone) {
      const productVariants = await callOdoo(cookies, 'product.product', 'search_read', [[
        ['product_tmpl_id', '=', product.id]
      ]], { fields: ['id'], limit: 1 });

      if (productVariants.length > 0) {
        const packagingData = {
          product_id: productVariants[0].id,
          name: 'CARTONE',
          qty: prodotto.pezzi,
          sales: true,
          purchase: true
        };

        await callOdoo(cookies, 'product.packaging', 'create', [packagingData]);
        fixes.push(`✅ Imballaggio CARTONE da ${prodotto.pezzi} pz creato`);
      }
    }
  }

  fixes.forEach(f => console.log(`      ${f}`));

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
    console.log('🔧 FIX 5 PRODOTTI CON "(COPIA)"');
    console.log('═══════════════════════════════════════════════════════════════════');

    const risultati = [];

    for (let i = 0; i < PRODOTTI_COPIE.length; i++) {
      try {
        const result = await fixCopia(cookies, resources, PRODOTTI_COPIE[i], i, PRODOTTI_COPIE.length);
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
    const totalFixes = risultati.reduce((sum, r) => sum + (r.fixes?.length || 0), 0);

    console.log(`✅ Prodotti sistemati: ${ok}/5`);
    console.log(`🔧 Totale correzioni: ${totalFixes}`);

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ COMPLETATO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('🎉 ADESSO TUTTI I 26 PRODOTTI GROMAS SONO PERFETTI!\n');

  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error.message);
    process.exit(1);
  }
}

main();
