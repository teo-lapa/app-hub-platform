/**
 * Verifica che l'ordine P10101 corrisponda ESATTAMENTE alla fattura GROMAS #2715
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// DATI ESATTI dalla fattura GROMAS #2715 del 30/10/2025
const FATTURA = [
  { codice: '26425', descrizione: 'GUANTI NERI M NITRILE REFLEXX 100 PZ', quantita: 60, prezzo: 4.29, importo: 257.40 },
  { codice: '032133', descrizione: 'SECCHIO CON STRIZZATORE RETT 12LT ZIF', quantita: 1, prezzo: 2.64, importo: 2.64 },
  { codice: '09632', descrizione: 'NEOFORT RAPIDO LT 0.75X6 +1SP', quantita: 4, prezzo: 17.52, importo: 70.08 },
  { codice: '09731', descrizione: 'PULIVAT CONF 750 ML X 6 PZ', quantita: 4, prezzo: 18.48, importo: 73.92 },
  { codice: '09733', descrizione: 'UNI5 SOAP IGIENIZZANTE BIANCO MANI 5KGX4', quantita: 4, prezzo: 19.55, importo: 78.20 },
  { codice: '11563', descrizione: 'PULIGEN DISINCROSTANTE FLAC 1LT X12', quantita: 24, prezzo: 5.50, importo: 132.00 },
  { codice: '270420', descrizione: 'EQO PIATTI A MANO TAN KG 5X4 INTER', quantita: 4, prezzo: 18.00, importo: 72.00 },
  { codice: '270421', descrizione: 'EQO PAVIMENTI ARANCIA-LIM KG 5X4 INTER', quantita: 4, prezzo: 15.84, importo: 63.36 },
  { codice: '270423', descrizione: 'EQO BAGNO ANTICALCARE LT0.75X6+6SP INTER', quantita: 4, prezzo: 11.22, importo: 44.88 },
  { codice: '270425', descrizione: 'EQO LAVASTOVIGLIE TAN KG 5.5 X 2 INTER', quantita: 5, prezzo: 13.10, importo: 65.50 },
  { codice: '31128', descrizione: 'RICAMBIO MOP SINTETICO', quantita: 10, prezzo: 3.14, importo: 31.40 },
  { codice: '26424', descrizione: 'GUANTI NERI L NITRILE REFLEX 100 PZ', quantita: 60, prezzo: 4.29, importo: 257.40 },
  { codice: '50004', descrizione: 'PELLICOLA SUPERPACK 300 MT CHAMPAGNE BOX', quantita: 9, prezzo: 5.00, importo: 45.00 },
  { codice: '70114', descrizione: 'EFFICACE MULTIGEN IGIENIZZANTE 0.75LT X6', quantita: 12, prezzo: 2.97, importo: 35.64 },
  { codice: '96855', descrizione: 'SACCHETTI CARTA BIANCO 14X30 B35 1000PZ', quantita: 4, prezzo: 19.25, importo: 77.00 },
  { codice: '39726', descrizione: 'ARGONIT AF/2 DISINFETTANTE LT0.75X6', quantita: 3, prezzo: 19.80, importo: 59.40 },
  { codice: '31828', descrizione: 'VINCO AMMORBIDENTE M.BIANCO 5KG X4 INTER', quantita: 16, prezzo: 7.70, importo: 123.20 },
  { codice: '270426', descrizione: 'EQO BRILLANTANTE TAN KG 5 X 2 INTER', quantita: 4, prezzo: 15.08, importo: 60.32 },
  { codice: '411024', descrizione: 'POLIUNTO X2 GROMAS 800 STRAPPI', quantita: 1, prezzo: 6.55, importo: 6.55 },
  { codice: '26426', descrizione: 'GUANTI NERI S NITRILE REFLEXX 100 PZ', quantita: 30, prezzo: 4.29, importo: 128.70 },
  { codice: '26423', descrizione: 'GUANTI NERI XL NITRILE REFLEX 100 PZ', quantita: 9, prezzo: 4.29, importo: 38.61 },
  { codice: '270424', descrizione: 'EQO VETRI E MULT LT 0.75X6+6SP INTER', quantita: 4, prezzo: 9.30, importo: 37.20 },
  { codice: '032123', descrizione: 'SPUGNA ZINCATA ACCIAIO 40GR x 25 pz ZIF', quantita: 25, prezzo: 0.44, importo: 11.00 },
  { codice: '270422', descrizione: 'EQO SGRASSATORE LIM LT 0.75X6+6SP INTER', quantita: 6, prezzo: 9.90, importo: 59.40 },
  { codice: '032120', descrizione: 'SCOPA CROMA ROSSO/NERO ZIF', quantita: 10, prezzo: 1.26, importo: 12.60 },
  { codice: '032124', descrizione: 'SPUGNA FIBRA 50PZ GROSSA ZIF', quantita: 200, prezzo: 0.33, importo: 66.00 }
];

const TOTALE_FATTURA = 1909.40;

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
  if (data.error) throw new Error(`Errore: ${data.error.data?.message || 'unknown'}`);
  return data.result;
}

async function main() {
  try {
    console.log('🔐 Autenticazione...');
    const cookies = await authenticate();
    console.log('✅ Autenticato\n');

    console.log('🔍 Ricerca ordine P10101...');
    const orders = await callOdoo(cookies, 'purchase.order', 'search_read', [[
      ['name', '=', 'P10101']
    ]], { fields: ['id', 'name', 'amount_untaxed', 'amount_total', 'currency_id'], limit: 1 });

    if (orders.length === 0) {
      console.log('❌ Ordine non trovato!');
      return;
    }

    const order = orders[0];
    console.log(`✅ Trovato: ${order.name} (ID: ${order.id})`);
    console.log(`   Totale imponibile: €${order.amount_untaxed.toFixed(2)}`);
    console.log(`   Totale documento: €${order.amount_total.toFixed(2)}\n`);

    console.log('📦 Caricamento righe ordine...');
    const lines = await callOdoo(cookies, 'purchase.order.line', 'search_read', [[
      ['order_id', '=', order.id]
    ]], {
      fields: ['product_id', 'name', 'product_qty', 'product_uom', 'price_unit', 'price_subtotal'],
      limit: 100
    });

    console.log(`✅ Trovate ${lines.length} righe\n`);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📋 VERIFICA COMPLETA: ORDINE vs FATTURA');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    let errori = 0;
    let warnings = 0;
    let totaleOrdine = 0;
    let totaleFattura = 0;

    // Crea una mappa delle righe ordine per codice prodotto
    const righeOrdineMap = {};

    for (const line of lines) {
      // Cerca il prodotto per ID
      const products = await callOdoo(cookies, 'product.product', 'read', [[line.product_id[0]]], {
        fields: ['default_code']
      });

      if (products.length > 0 && products[0].default_code) {
        const codice = products[0].default_code;
        righeOrdineMap[codice] = line;
      }
    }

    // Verifica ogni riga della fattura
    for (let i = 0; i < FATTURA.length; i++) {
      const rigaFattura = FATTURA[i];
      console.log(`[${i + 1}/${FATTURA.length}] ${rigaFattura.codice} - ${rigaFattura.descrizione.substring(0, 35)}...`);

      totaleFattura += rigaFattura.importo;

      const rigaOrdine = righeOrdineMap[rigaFattura.codice];

      if (!rigaOrdine) {
        console.log(`   ❌ PRODOTTO NON TROVATO NELL'ORDINE!\n`);
        errori++;
        continue;
      }

      // Verifica quantità
      const qtyOk = Math.abs(rigaOrdine.product_qty - rigaFattura.quantita) < 0.01;
      const qtyIcon = qtyOk ? '✅' : '❌';
      console.log(`   ${qtyIcon} Quantità: Ordine=${rigaOrdine.product_qty} | Fattura=${rigaFattura.quantita}`);

      if (!qtyOk) {
        errori++;
      }

      // Verifica prezzo unitario
      const priceOk = Math.abs(rigaOrdine.price_unit - rigaFattura.prezzo) < 0.01;
      const priceIcon = priceOk ? '✅' : '❌';
      console.log(`   ${priceIcon} Prezzo: Ordine=€${rigaOrdine.price_unit.toFixed(2)} | Fattura=€${rigaFattura.prezzo.toFixed(2)}`);

      if (!priceOk) {
        errori++;
      }

      // Verifica importo totale riga
      const importoOrdine = rigaOrdine.price_subtotal;
      const importoOk = Math.abs(importoOrdine - rigaFattura.importo) < 0.01;
      const importoIcon = importoOk ? '✅' : '❌';
      console.log(`   ${importoIcon} Importo: Ordine=€${importoOrdine.toFixed(2)} | Fattura=€${rigaFattura.importo.toFixed(2)}`);

      if (!importoOk) {
        errori++;
      }

      totaleOrdine += importoOrdine;

      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('TOTALI:');
    console.log(`   Totale ordine calcolato:  €${totaleOrdine.toFixed(2)}`);
    console.log(`   Totale ordine Odoo:       €${order.amount_untaxed.toFixed(2)}`);
    console.log(`   Totale fattura GROMAS:    €${TOTALE_FATTURA.toFixed(2)}\n`);

    const differenza = Math.abs(totaleOrdine - TOTALE_FATTURA);
    const differenzaIcon = differenza < 0.10 ? '✅' : '❌';
    console.log(`${differenzaIcon} Differenza: €${differenza.toFixed(2)}\n`);

    console.log('VERIFICA:');
    console.log(`   ✅ Prodotti trovati: ${FATTURA.length - errori}/${FATTURA.length}`);
    console.log(`   ❌ Errori trovati: ${errori}`);
    console.log(`   ⚠️  Warning: ${warnings}\n`);

    if (errori === 0 && differenza < 0.10) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('🎉 PERFETTO! L\'ORDINE CORRISPONDE ESATTAMENTE ALLA FATTURA!');
      console.log('═══════════════════════════════════════════════════════════════════\n');
    } else {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('⚠️  ATTENZIONE: Ci sono differenze tra ordine e fattura');
      console.log('═══════════════════════════════════════════════════════════════════\n');
    }

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
