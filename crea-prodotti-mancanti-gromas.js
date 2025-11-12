/**
 * Script per creare i 6 prodotti mancanti dalla fattura GROMAS
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODOTTI_DA_CREARE = [
  {
    codice: '26424',
    nome: 'Guanti in Nitrile Reflexx Monouso Neri Taglia L - Confezione 100pz',
    tipo: 'SINGOLO',
    pezzi_per_cartone: 0,
    prezzo_fattura: 4.29,
    categoria: 'Non Food / Attrezzature'
  },
  {
    codice: '39726',
    nome: 'ARGONIT AF/2 Disinfettante Professionale 750ml - Confezione 6 pezzi',
    tipo: 'CARTONE',
    pezzi_per_cartone: 6,
    prezzo_fattura: 19.80,
    categoria: 'Non Food / Detergenza'
  },
  {
    codice: '31828',
    nome: 'VINCO Ammorbidente Muschio Bianco 5kg - Confezione 4 Taniche',
    tipo: 'CARTONE',
    pezzi_per_cartone: 4,
    prezzo_fattura: 7.70,
    categoria: 'Non Food / Detergenza'
  },
  {
    codice: '270426',
    nome: 'EQO Brillantante Professional per Lavastoviglie Tanica 5kg - Confezione 2 pezzi',
    tipo: 'CARTONE',
    pezzi_per_cartone: 2,
    prezzo_fattura: 15.08,
    categoria: 'Non Food / Detergenza'
  },
  {
    codice: '411024',
    nome: 'POLIUNTO X2 Carta Multiuso Gromas - Rotolo 800 Strappi - Confezione 2 pezzi',
    tipo: 'SINGOLO',
    pezzi_per_cartone: 0,
    prezzo_fattura: 6.55,
    categoria: 'Non Food / Detergenza'
  },
  {
    codice: '26426',
    nome: 'Guanti in Nitrile Reflexx Monouso Neri Taglia S - Confezione 100pz',
    tipo: 'SINGOLO',
    pezzi_per_cartone: 0,
    prezzo_fattura: 4.29,
    categoria: 'Non Food / Attrezzature'
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
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova UoM CRT
  const uomCRT = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CRT']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova valuta EUR
  const eurCurrency = await callOdoo(cookies, 'res.currency', 'search_read', [[
    ['name', '=', 'EUR']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova fornitore GROMAS
  const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova categoria "Non Food / Detergenza"
  const catDetergenza = await callOdoo(cookies, 'product.category', 'search_read', [[
    ['complete_name', 'ilike', 'Non Food / Detergenza']
  ]], { fields: ['id', 'complete_name'], limit: 1 });

  // Trova categoria "Non Food / Attrezzature"
  const catAttrezzature = await callOdoo(cookies, 'product.category', 'search_read', [[
    ['complete_name', 'ilike', 'Non Food / Attrezzature']
  ]], { fields: ['id', 'complete_name'], limit: 1 });

  console.log('✅ UoM PZ:', uomPZ[0] ? uomPZ[0].name : 'NON TROVATO');
  console.log('✅ UoM CRT:', uomCRT[0] ? uomCRT[0].name : 'NON TROVATO');
  console.log('✅ Valuta EUR:', eurCurrency[0] ? eurCurrency[0].name : 'NON TROVATO');
  console.log('✅ Fornitore GROMAS:', gromas[0] ? gromas[0].name : 'NON TROVATO');
  console.log('✅ Categoria Detergenza:', catDetergenza[0] ? catDetergenza[0].complete_name : 'NON TROVATO');
  console.log('✅ Categoria Attrezzature:', catAttrezzature[0] ? catAttrezzature[0].complete_name : 'NON TROVATO');
  console.log('');

  return {
    uomPZ: uomPZ[0],
    uomCRT: uomCRT[0],
    eurCurrency: eurCurrency[0],
    gromas: gromas[0],
    catDetergenza: catDetergenza[0],
    catAttrezzature: catAttrezzature[0]
  };
}

async function createProduct(cookies, prodotto, resources) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 CREAZIONE: [${prodotto.codice}] ${prodotto.nome}`);
  console.log(`${'='.repeat(80)}\n`);

  // Calcola costo per pezzo
  const costoPerPezzo = prodotto.tipo === 'CARTONE'
    ? (prodotto.prezzo_fattura / prodotto.pezzi_per_cartone)
    : prodotto.prezzo_fattura;

  // Determina UoM - USA SOLO PZ per ora (evita problema categoria)
  const uomVendita = resources.uomPZ.id;
  const uomAcquisto = resources.uomPZ.id; // Temporaneamente tutto PZ

  // Determina categoria
  const categoriaId = prodotto.categoria.includes('Attrezzature')
    ? resources.catAttrezzature.id
    : resources.catDetergenza.id;

  console.log('📋 Configurazione:');
  console.log(`   Tipo: ${prodotto.tipo}`);
  console.log(`   UoM Vendita: PZ`);
  console.log(`   UoM Acquisto: PZ (sistemeremo il cartone dopo con packaging)`);
  console.log(`   Costo: ${costoPerPezzo.toFixed(2)}€ per pezzo`);
  if (prodotto.tipo === 'CARTONE') {
    console.log(`   Prezzo fattura: ${prodotto.prezzo_fattura.toFixed(2)}€ per cartone (${prodotto.pezzi_per_cartone} pz)`);
  }
  console.log(`   Categoria: ${prodotto.categoria}`);
  console.log('');

  // Crea il prodotto
  console.log('🔨 Creazione prodotto in Odoo...');

  const productData = {
    name: prodotto.nome,
    default_code: prodotto.codice,
    type: 'product',
    categ_id: categoriaId,
    uom_id: uomVendita,
    uom_po_id: uomAcquisto,
    standard_price: costoPerPezzo,
    list_price: costoPerPezzo * 2, // Prezzo vendita x2 (temporaneo)
    purchase_ok: true,
    sale_ok: true,
    active: true,
    // NO imposte acquisto (import/export)
    supplier_taxes_id: [[6, 0, []]]
  };

  const productId = await callOdoo(cookies, 'product.template', 'create', [productData]);

  console.log(`✅ Prodotto creato! ID: ${productId}\n`);

  // Aggiungi info fornitore GROMAS
  console.log('🏢 Aggiunta informazioni fornitore GROMAS...');

  const supplierInfoData = {
    partner_id: resources.gromas.id,
    product_tmpl_id: productId,
    price: prodotto.prezzo_fattura,
    currency_id: resources.eurCurrency.id,
    min_qty: 1
  };

  const supplierInfoId = await callOdoo(cookies, 'product.supplierinfo', 'create', [supplierInfoData]);

  console.log(`✅ Info fornitore aggiunta! ID: ${supplierInfoId}\n`);

  console.log(`${'='.repeat(80)}`);
  console.log('✅ PRODOTTO CREATO CON SUCCESSO!');
  console.log(`${'='.repeat(80)}\n`);

  return {
    codice: prodotto.codice,
    nome: prodotto.nome,
    odoo_id: productId,
    supplier_info_id: supplierInfoId
  };
}

async function main() {
  try {
    const cookies = await authenticate();
    const resources = await findResources(cookies);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('         CREAZIONE PRODOTTI MANCANTI - FATTURA GROMAS');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log(`📦 Prodotti da creare: ${PRODOTTI_DA_CREARE.length}\n`);

    const risultati = [];

    for (const prodotto of PRODOTTI_DA_CREARE) {
      const risultato = await createProduct(cookies, prodotto, resources);
      risultati.push(risultato);

      // Pausa tra le creazioni
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // RIEPILOGO
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('✅ TUTTI I PRODOTTI SONO STATI CREATI CON SUCCESSO!\n');
    console.log('📋 Prodotti creati:\n');

    risultati.forEach((r, index) => {
      console.log(`${index + 1}. [${r.codice}] ${r.nome}`);
      console.log(`   ID Odoo: ${r.odoo_id}`);
      console.log(`   Fornitore configurato: ✅\n`);
    });

    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('💡 PROSSIMI PASSI:');
    console.log('   1. Verificare i prodotti in Odoo');
    console.log('   2. Sistemare i 20 prodotti esistenti');
    console.log('   3. Aggiungere packaging dove necessario\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
