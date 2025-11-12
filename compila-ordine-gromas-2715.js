/**
 * Script per compilare l'ordine di acquisto P10101
 * con le quantità esatte dalla fattura GROMAS #2715
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// QUANTITÀ ESATTE dalla fattura GROMAS #2715 del 30/10/2025
const PRODOTTI_FATTURA = [
  { codice: '26425', descrizione: 'GUANTI NERI M NITRILE REFLEXX 100 PZ', quantita: 60, uom: 'CONF', prezzo: 4.29 },
  { codice: '032133', descrizione: 'SECCHIO CON STRIZZATORE RETT 12LT ZIF', quantita: 1, uom: 'PZ', prezzo: 2.64 },
  { codice: '09632', descrizione: 'NEOFORT RAPIDO LT 0.75X6 +1SP', quantita: 4, uom: 'CRT-6', prezzo: 17.52 },
  { codice: '09731', descrizione: 'PULIVAT CONF 750 ML X 6 PZ', quantita: 4, uom: 'CRT-6', prezzo: 18.48 },
  { codice: '09733', descrizione: 'UNI5 SOAP IGIENIZZANTE BIANCO MANI 5KGX4', quantita: 4, uom: 'CRT-4', prezzo: 19.55 },
  { codice: '11563', descrizione: 'PULIGEN DISINCROSTANTE FLAC 1LT X12', quantita: 24, uom: 'CRT-12', prezzo: 5.50 },
  { codice: '270420', descrizione: 'EQO PIATTI A MANO TAN KG 5X4 INTER', quantita: 4, uom: 'CRT-4', prezzo: 18.00 },
  { codice: '270421', descrizione: 'EQO PAVIMENTI ARANCIA-LIM KG 5X4 INTER', quantita: 4, uom: 'CRT-4', prezzo: 15.84 },
  { codice: '270423', descrizione: 'EQO BAGNO ANTICALCARE LT0.75X6+6SP INTER', quantita: 4, uom: 'CRT-6', prezzo: 11.22 },
  { codice: '270425', descrizione: 'EQO LAVASTOVIGLIE TAN KG 5.5 X 2 INTER', quantita: 5, uom: 'CRT-2', prezzo: 13.10 },
  { codice: '31128', descrizione: 'RICAMBIO MOP SINTETICO', quantita: 10, uom: 'PZ', prezzo: 3.14 },
  { codice: '26424', descrizione: 'GUANTI NERI L NITRILE REFLEX 100 PZ', quantita: 60, uom: 'CONF', prezzo: 4.29 },
  { codice: '50004', descrizione: 'PELLICOLA SUPERPACK 300 MT CHAMPAGNE BOX', quantita: 9, uom: 'PZ', prezzo: 5.00 },
  { codice: '70114', descrizione: 'EFFICACE MULTIGEN IGIENIZZANTE 0.75LT X6', quantita: 12, uom: 'CRT-6', prezzo: 2.97 },
  { codice: '96855', descrizione: 'SACCHETTI CARTA BIANCO 14X30 B35 1000PZ', quantita: 4, uom: 'PZ', prezzo: 19.25 },
  { codice: '39726', descrizione: 'ARGONIT AF/2 DISINFETTANTE LT0.75X6', quantita: 3, uom: 'CRT-6', prezzo: 19.80 },
  { codice: '31828', descrizione: 'VINCO AMMORBIDENTE M.BIANCO 5KG X4 INTER', quantita: 16, uom: 'CRT-4', prezzo: 7.70 },
  { codice: '270426', descrizione: 'EQO BRILLANTANTE TAN KG 5 X 2 INTER', quantita: 4, uom: 'CRT-2', prezzo: 15.08 },
  { codice: '411024', descrizione: 'POLIUNTO X2 GROMAS 800 STRAPPI', quantita: 1, uom: 'PZ', prezzo: 6.55 },
  { codice: '26426', descrizione: 'GUANTI NERI S NITRILE REFLEXX 100 PZ', quantita: 30, uom: 'CONF', prezzo: 4.29 },
  { codice: '26423', descrizione: 'GUANTI NERI XL NITRILE REFLEX 100 PZ', quantita: 9, uom: 'CONF', prezzo: 4.29 },
  { codice: '270424', descrizione: 'EQO VETRI E MULT LT 0.75X6+6SP INTER', quantita: 4, uom: 'CRT-6', prezzo: 9.30 },
  { codice: '032123', descrizione: 'SPUGNA ZINCATA ACCIAIO 40GR x 25 pz ZIF', quantita: 25, uom: 'CRT-25', prezzo: 0.44 },
  { codice: '270422', descrizione: 'EQO SGRASSATORE LIM LT 0.75X6+6SP INTER', quantita: 6, uom: 'CRT-6', prezzo: 9.90 },
  { codice: '032120', descrizione: 'SCOPA CROMA ROSSO/NERO ZIF', quantita: 10, uom: 'PZ', prezzo: 1.26 },
  { codice: '032124', descrizione: 'SPUGNA FIBRA 50PZ GROSSA ZIF', quantita: 200, uom: 'CRT-50', prezzo: 0.33 }
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

async function main() {
  try {
    console.log('🔐 Autenticazione...');
    const cookies = await authenticate();
    console.log('✅ Autenticato\n');

    console.log('🔍 Ricerca ordine P10101...');

    // Cerca l'ordine P10101
    const orders = await callOdoo(cookies, 'purchase.order', 'search_read', [[
      ['name', '=', 'P10101']
    ]], { fields: ['id', 'name', 'state', 'partner_id'], limit: 1 });

    if (orders.length === 0) {
      console.log('❌ Ordine P10101 non trovato!');
      return;
    }

    const order = orders[0];
    console.log(`✅ Trovato ordine: ${order.name} (ID: ${order.id})`);
    console.log(`   Fornitore: ${order.partner_id[1]}`);
    console.log(`   Stato: ${order.state}\n`);

    // Trova GROMAS
    const gromas = await callOdoo(cookies, 'res.partner', 'search_read', [[
      ['name', 'ilike', 'GROMAS']
    ]], { fields: ['id', 'name'], limit: 1 });

    if (gromas.length === 0) {
      console.log('❌ Fornitore GROMAS non trovato!');
      return;
    }

    console.log(`✅ Fornitore GROMAS: ${gromas[0].name} (ID: ${gromas[0].id})\n`);

    // Elimina tutte le righe esistenti dell'ordine
    console.log('🗑️  Eliminazione righe esistenti...');
    const existingLines = await callOdoo(cookies, 'purchase.order.line', 'search_read', [[
      ['order_id', '=', order.id]
    ]], { fields: ['id'], limit: 100 });

    if (existingLines.length > 0) {
      await callOdoo(cookies, 'purchase.order.line', 'unlink', [existingLines.map(l => l.id)]);
      console.log(`✅ Eliminate ${existingLines.length} righe\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📦 AGGIUNTA PRODOTTI ALL\'ORDINE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    let totaleRighe = 0;
    let totaleImporto = 0;

    for (const item of PRODOTTI_FATTURA) {
      console.log(`[${totaleRighe + 1}/${PRODOTTI_FATTURA.length}] 📦 ${item.codice} - ${item.descrizione.substring(0, 40)}...`);
      console.log(`   Quantità: ${item.quantita} ${item.uom} | Prezzo: €${item.prezzo}`);

      // Cerca prodotto
      const products = await callOdoo(cookies, 'product.template', 'search_read', [[
        ['default_code', '=', item.codice]
      ]], { fields: ['id', 'name', 'uom_po_id'], limit: 1 });

      if (products.length === 0) {
        console.log(`   ❌ PRODOTTO NON TROVATO!\n`);
        continue;
      }

      const product = products[0];

      // Trova la variante del prodotto
      const variants = await callOdoo(cookies, 'product.product', 'search_read', [[
        ['product_tmpl_id', '=', product.id]
      ]], { fields: ['id'], limit: 1 });

      if (variants.length === 0) {
        console.log(`   ❌ VARIANTE NON TROVATA!\n`);
        continue;
      }

      const productVariantId = variants[0].id;

      // Trova l'UoM
      const uoms = await callOdoo(cookies, 'uom.uom', 'search_read', [[
        ['name', '=', item.uom]
      ]], { fields: ['id'], limit: 1 });

      if (uoms.length === 0) {
        console.log(`   ⚠️  UoM ${item.uom} non trovato, uso UoM acquisto predefinito\n`);

        // Crea riga ordine con UoM predefinito
        await callOdoo(cookies, 'purchase.order.line', 'create', [{
          order_id: order.id,
          product_id: productVariantId,
          name: product.name,
          product_qty: item.quantita,
          product_uom: product.uom_po_id[0],
          price_unit: item.prezzo,
          date_planned: new Date().toISOString().split('T')[0]
        }]);
      } else {
        // Crea riga ordine con UoM specificato
        await callOdoo(cookies, 'purchase.order.line', 'create', [{
          order_id: order.id,
          product_id: productVariantId,
          name: product.name,
          product_qty: item.quantita,
          product_uom: uoms[0].id,
          price_unit: item.prezzo,
          date_planned: new Date().toISOString().split('T')[0]
        }]);
      }

      const importoRiga = item.quantita * item.prezzo;
      totaleImporto += importoRiga;
      totaleRighe++;

      console.log(`   ✅ Aggiunta! Importo: €${importoRiga.toFixed(2)}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log(`✅ Righe aggiunte: ${totaleRighe}/${PRODOTTI_FATTURA.length}`);
    console.log(`💰 Totale imponibile: €${totaleImporto.toFixed(2)}`);
    console.log(`📄 Totale fattura GROMAS #2715: €1,909.40\n`);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ ORDINE COMPILATO CON SUCCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log(`🔗 Apri l'ordine: ${ODOO_URL}/web#id=${order.id}&model=purchase.order&view_type=form\n`);

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
