/**
 * Script per analizzare TUTTI i prodotti del fornitore GROMAS
 * e creare una lista di cosa sistemare
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

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

async function findGromas(cookies) {
  console.log('\n🔍 Ricerca fornitore GROMAS...');

  const partners = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], {
    fields: ['id', 'name', 'is_company', 'supplier_rank']
  });

  if (partners.length === 0) {
    throw new Error('Fornitore GROMAS non trovato');
  }

  const gromas = partners[0];
  console.log('✅ Fornitore trovato:');
  console.log('   ID:', gromas.id);
  console.log('   Nome:', gromas.name);

  return gromas;
}

async function analyzeGromasProducts(cookies, gromasId) {
  console.log('\n📦 Ricerca TUTTI i prodotti di GROMAS...\n');

  // Cerca tutte le righe supplierinfo di GROMAS
  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['partner_id', '=', gromasId]
  ]], {
    fields: ['id', 'product_tmpl_id', 'product_id', 'product_name', 'product_code', 'price', 'currency_id', 'min_qty'],
    limit: 1000
  });

  console.log(`✅ Trovate ${supplierInfos.length} righe fornitore GROMAS\n`);
  console.log('=' .repeat(100));

  // Raccogliamo tutti i product_tmpl_id unici
  const templateIds = [...new Set(supplierInfos.map(s => s.product_tmpl_id ? s.product_tmpl_id[0] : null).filter(Boolean))];

  console.log(`\n📋 Prodotti unici: ${templateIds.length}\n`);

  // Leggi tutti i template per avere info complete
  const templates = await callOdoo(cookies, 'product.template', 'read', [templateIds], {
    fields: [
      'id',
      'name',
      'default_code',
      'uom_id',
      'uom_po_id',
      'standard_price',
      'list_price',
      'categ_id',
      'supplier_taxes_id',
      'taxes_id'
    ]
  });

  console.log('🔍 ANALISI COMPLETA PRODOTTI GROMAS:\n');
  console.log('=' .repeat(100));

  const problemi = [];

  for (const template of templates) {
    const supplierInfo = supplierInfos.find(s => s.product_tmpl_id && s.product_tmpl_id[0] === template.id);

    console.log(`\n📦 ${template.default_code || 'NO-CODE'} - ${template.name}`);
    console.log('   Product Template ID:', template.id);

    // Analisi UoM
    const uomVendita = template.uom_id ? template.uom_id[1] : 'N/A';
    const uomAcquisto = template.uom_po_id ? template.uom_po_id[1] : 'N/A';

    console.log('   📏 UoM Vendita:', uomVendita);
    console.log('   📏 UoM Acquisto:', uomAcquisto);

    // Problema: UoM non configurato correttamente?
    if (uomVendita === uomAcquisto && uomVendita === 'PZ') {
      problemi.push({
        tipo: 'UOM_DA_VERIFICARE',
        prodotto: template.name,
        codice: template.default_code,
        id: template.id,
        dettaglio: 'UoM vendita e acquisto sono entrambi PZ - verificare se serve CRT'
      });
      console.log('   ⚠️  UoM: Entrambi PZ - da verificare se serve CRT');
    }

    // Analisi prezzi
    console.log('   💰 Costo:', template.standard_price, '€');
    console.log('   💰 Prezzo vendita:', template.list_price, '€');

    if (supplierInfo) {
      console.log('   🏢 Prezzo fornitore:', supplierInfo.price, supplierInfo.currency_id ? supplierInfo.currency_id[1] : 'N/A');

      // Problema: Valuta non EUR
      if (supplierInfo.currency_id && supplierInfo.currency_id[1] !== 'EUR') {
        problemi.push({
          tipo: 'VALUTA_ERRATA',
          prodotto: template.name,
          codice: template.default_code,
          id: template.id,
          dettaglio: `Valuta fornitore: ${supplierInfo.currency_id[1]} (dovrebbe essere EUR)`
        });
        console.log('   ❌ PROBLEMA: Valuta', supplierInfo.currency_id[1], '- dovrebbe essere EUR');
      }
    }

    // Analisi imposte
    const imposteVendita = template.taxes_id && template.taxes_id.length > 0 ? 'SÌ' : 'NO';
    const imposteAcquisto = template.supplier_taxes_id && template.supplier_taxes_id.length > 0 ? 'SÌ' : 'NO';

    console.log('   🧾 Imposte vendita:', imposteVendita);
    console.log('   🧾 Imposte acquisto:', imposteAcquisto);

    // Problema: Imposte acquisto presenti (per import/export dovrebbero essere 0)
    if (template.supplier_taxes_id && template.supplier_taxes_id.length > 0) {
      problemi.push({
        tipo: 'IMPOSTE_ACQUISTO_DA_RIMUOVERE',
        prodotto: template.name,
        codice: template.default_code,
        id: template.id,
        dettaglio: 'Ha imposte in acquisto (per import/export dovrebbero essere 0)'
      });
      console.log('   ⚠️  Ha imposte in acquisto - da rimuovere per import/export');
    }

    console.log('   📂 Categoria:', template.categ_id ? template.categ_id[1] : 'N/A');
    console.log('-'.repeat(100));
  }

  // SUMMARY
  console.log('\n\n');
  console.log('=' .repeat(100));
  console.log('📊 RIEPILOGO PROBLEMI TROVATI');
  console.log('=' .repeat(100));

  const problemiPerTipo = problemi.reduce((acc, p) => {
    if (!acc[p.tipo]) acc[p.tipo] = [];
    acc[p.tipo].push(p);
    return acc;
  }, {});

  console.log(`\n✅ Totale prodotti analizzati: ${templates.length}`);
  console.log(`⚠️  Totale problemi trovati: ${problemi.length}\n`);

  for (const [tipo, items] of Object.entries(problemiPerTipo)) {
    console.log(`\n🔴 ${tipo}: ${items.length} prodotti`);
    console.log('-'.repeat(100));

    for (const item of items) {
      console.log(`   • [${item.codice || 'NO-CODE'}] ${item.prodotto}`);
      console.log(`     ID: ${item.id} | ${item.dettaglio}`);
    }
  }

  console.log('\n\n');
  console.log('=' .repeat(100));
  console.log('💡 PROSSIMI PASSI');
  console.log('=' .repeat(100));
  console.log('\n1. Rivedere la lista insieme');
  console.log('2. Decidere quali prodotti sistemare');
  console.log('3. Sistemare imposte acquisto (rimuovere per import/export)');
  console.log('4. Sistemare valute (EUR invece di CHF)');
  console.log('5. Sistemare UoM dove necessario (PZ/CRT)');

  return { templates, problemi, supplierInfos };
}

async function main() {
  try {
    const cookies = await authenticate();
    const gromas = await findGromas(cookies);
    const analisi = await analyzeGromasProducts(cookies, gromas.id);

    console.log('\n\n✅ Analisi completata!');
    console.log(`\n📦 Totale prodotti GROMAS: ${analisi.templates.length}`);
    console.log(`⚠️  Problemi da risolvere: ${analisi.problemi.length}`);

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
