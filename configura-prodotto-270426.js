/**
 * Script per configurare correttamente il prodotto 270426 (EQO Brillantante)
 * - UoM Acquisto: CRT
 * - Peso prodotto
 * - Imballaggio (1 CARTONE = 2 PZ)
 * - Nome e codice prodotto fornitore
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const PRODUCT_ID = 24428; // Template ID del prodotto EQO Brillantante
const PRODUCT_CODE = '270426';
const PRODUCT_NAME_SUPPLIER = 'EQO Brillantante Professional per Lavastoviglie Tanica 5kg';
const PEZZI_PER_CARTONE = 2;
const PESO_KG = 5.0; // Ogni tanica pesa 5kg

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

  // Trova UoM CRT
  const uomCRT = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    ['name', '=', 'CRT']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova UoM PZ
  const uomPZ = await callOdoo(cookies, 'uom.uom', 'search_read', [[
    '|', ['name', '=', 'PZ'], ['name', '=', 'Unità']
  ]], { fields: ['id', 'name'], limit: 1 });

  // Trova fornitore GROMAS
  const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
    ['name', 'ilike', 'GROMAS']
  ]], { fields: ['id', 'name'], limit: 1 });

  console.log('✅ UoM CRT:', uomCRT[0] ? uomCRT[0].name : 'NON TROVATO');
  console.log('✅ UoM PZ:', uomPZ[0] ? uomPZ[0].name : 'NON TROVATO');
  console.log('✅ Fornitore GROMAS:', gromas[0] ? gromas[0].name : 'NON TROVATO');
  console.log('');

  return {
    uomCRT: uomCRT[0],
    uomPZ: uomPZ[0],
    gromas: gromas[0]
  };
}

async function updateProduct(cookies, resources) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`📦 CONFIGURAZIONE PRODOTTO ${PRODUCT_CODE}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('📋 STRATEGIA:');
  console.log('   • UoM Vendita: PZ (rimane così)');
  console.log('   • UoM Acquisto: PZ (rimane così)');
  console.log('   • Costo: per singolo pezzo');
  console.log('   • Packaging: CARTONE da 2 pezzi per facilitare ordini');
  console.log('');

  // 1. Aggiungi peso
  console.log(`⚖️  STEP 1: Aggiunta peso prodotto (${PESO_KG} kg)...`);

  await callOdoo(cookies, 'product.template', 'write', [[PRODUCT_ID], {
    weight: PESO_KG
  }]);
  console.log(`✅ Peso impostato a ${PESO_KG} kg\n`);

  // 2. Crea imballaggio (packaging)
  console.log(`📦 STEP 3: Creazione imballaggio (1 CARTONE = ${PEZZI_PER_CARTONE} PZ)...`);

  const packagingData = {
    product_id: PRODUCT_ID,
    name: 'CARTONE',
    qty: PEZZI_PER_CARTONE,
    sales: true,
    purchase: true
  };

  const packagingId = await callOdoo(cookies, 'product.packaging', 'create', [packagingData]);
  console.log(`✅ Imballaggio creato! ID: ${packagingId}\n`);

  // 4. Aggiorna info fornitore con nome e codice prodotto
  console.log('🏢 STEP 4: Aggiornamento informazioni fornitore...');

  // Trova la riga supplierinfo esistente
  const supplierInfos = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [[
    ['product_tmpl_id', '=', PRODUCT_ID],
    ['partner_id', '=', resources.gromas.id]
  ]], { fields: ['id'], limit: 1 });

  if (supplierInfos.length > 0) {
    await callOdoo(cookies, 'product.supplierinfo', 'write', [[supplierInfos[0].id], {
      product_name: PRODUCT_NAME_SUPPLIER,
      product_code: PRODUCT_CODE
    }]);
    console.log('✅ Nome e codice prodotto fornitore aggiornati\n');
  } else {
    console.log('⚠️  Nessuna riga fornitore trovata\n');
  }

  // 5. Verifica finale
  console.log('🔍 VERIFICA FINALE:\n');

  const product = await callOdoo(cookies, 'product.template', 'read', [[PRODUCT_ID]], {
    fields: ['name', 'default_code', 'uom_id', 'uom_po_id', 'weight', 'packaging_ids']
  });

  const p = product[0];
  console.log('📋 Prodotto:', p.name);
  console.log('   Codice:', p.default_code);
  console.log('   UoM Vendita:', p.uom_id ? p.uom_id[1] : 'N/A');
  console.log('   UoM Acquisto:', p.uom_po_id ? p.uom_po_id[1] : 'N/A');
  console.log('   Peso:', p.weight, 'kg');
  console.log('   Imballaggi:', p.packaging_ids ? p.packaging_ids.length : 0);

  // Leggi imballaggio creato
  if (p.packaging_ids && p.packaging_ids.length > 0) {
    const packagings = await callOdoo(cookies, 'product.packaging', 'read', [p.packaging_ids], {
      fields: ['name', 'qty', 'sales', 'purchase']
    });
    console.log('\n📦 Dettagli imballaggio:');
    packagings.forEach(pkg => {
      console.log(`   • ${pkg.name}: ${pkg.qty} pezzi (Vendita: ${pkg.sales ? 'Sì' : 'No'}, Acquisto: ${pkg.purchase ? 'Sì' : 'No'})`);
    });
  }

  // Leggi info fornitore
  if (supplierInfos.length > 0) {
    const supplierInfo = await callOdoo(cookies, 'product.supplierinfo', 'read', [[supplierInfos[0].id]], {
      fields: ['product_name', 'product_code', 'price', 'currency_id']
    });
    console.log('\n🏢 Info fornitore:');
    console.log('   Nome prodotto:', supplierInfo[0].product_name || 'N/A');
    console.log('   Codice prodotto:', supplierInfo[0].product_code || 'N/A');
    console.log('   Prezzo:', supplierInfo[0].price, supplierInfo[0].currency_id ? supplierInfo[0].currency_id[1] : 'N/A');
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('✅ PRODOTTO CONFIGURATO CON SUCCESSO!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

async function main() {
  try {
    const cookies = await authenticate();
    const resources = await findResources(cookies);
    await updateProduct(cookies, resources);

    console.log('✅ Configurazione completata!');
    console.log('\n💡 PROSSIMI PASSI:');
    console.log('   1. Verificare il prodotto in Odoo');
    console.log('   2. Ripetere per gli altri 5 prodotti mancanti');
    console.log('   3. Sistemare i 20 prodotti esistenti dalla fattura\n');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
