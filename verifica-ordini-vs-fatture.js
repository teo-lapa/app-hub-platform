/**
 * VERIFICA: ORDINI vs FATTURE - OTTOBRE 2025
 *
 * Confronta i dati tra:
 * - Ordini di vendita (sale.order)
 * - Fatture emesse (account.move)
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const START_DATE = '2025-10-01';
const END_DATE = '2025-10-31';

let sessionCookies = '';

async function authenticate() {
  console.log('🔐 Autenticazione...');
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      }
    })
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    sessionCookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
  }

  const data = await response.json();
  if (data.error || !data.result?.uid) {
    throw new Error('Autenticazione fallita');
  }
  console.log('✅ Autenticato!\n');
  return data.result;
}

async function callOdoo(model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs }
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Errore: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function main() {
  try {
    await authenticate();

    console.log('📊 CONFRONTO ORDINI vs FATTURE - OTTOBRE 2025\n');
    console.log('='.repeat(80));

    // 1. ORDINI DI VENDITA
    console.log('\n🛒 ORDINI DI VENDITA (sale.order):');
    const orders = await callOdoo('sale.order', 'search_read', [
      [
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', START_DATE],
        ['date_order', '<=', END_DATE + ' 23:59:59']
      ]
    ], {
      fields: ['name', 'date_order', 'amount_total', 'invoice_status']
    });

    const totaleOrdini = orders.reduce((sum, o) => sum + o.amount_total, 0);
    console.log(`   Numero ordini: ${orders.length}`);
    console.log(`   Totale: €${totaleOrdini.toFixed(2)}`);

    // Stati fatturazione
    const invoiceStatuses = {};
    orders.forEach(o => {
      invoiceStatuses[o.invoice_status] = (invoiceStatuses[o.invoice_status] || 0) + 1;
    });
    console.log(`   Stati fatturazione:`);
    Object.entries(invoiceStatuses).forEach(([status, count]) => {
      console.log(`      ${status}: ${count} ordini`);
    });

    // 2. FATTURE EMESSE
    console.log('\n📄 FATTURE (account.move):');
    const invoices = await callOdoo('account.move', 'search_read', [
      [
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'], // Solo fatture confermate
        ['invoice_date', '>=', START_DATE],
        ['invoice_date', '<=', END_DATE]
      ]
    ], {
      fields: ['name', 'invoice_date', 'amount_total', 'amount_untaxed', 'invoice_line_ids']
    });

    const totaleFatture = invoices.reduce((sum, i) => sum + i.amount_total, 0);
    const totaleSenzaIVA = invoices.reduce((sum, i) => sum + i.amount_untaxed, 0);
    console.log(`   Numero fatture: ${invoices.length}`);
    console.log(`   Totale con IVA: €${totaleFatture.toFixed(2)}`);
    console.log(`   Totale senza IVA: €${totaleSenzaIVA.toFixed(2)}`);

    // 3. CONFRONTO
    console.log('\n📊 CONFRONTO:');
    console.log('='.repeat(80));
    console.log(`   Ordini (${orders.length}):      €${totaleOrdini.toFixed(2)}`);
    console.log(`   Fatture (${invoices.length}):     €${totaleFatture.toFixed(2)}`);
    console.log(`   Differenza:       €${(totaleOrdini - totaleFatture).toFixed(2)}`);
    console.log('='.repeat(80));

    console.log('\n❓ COSA USARE PER LA DASHBOARD?\n');
    console.log('1. ORDINI (sale.order):');
    console.log('   ✅ Rappresentano le vendite effettuate');
    console.log('   ✅ Include i margini reali dei prodotti');
    console.log('   ✅ Mostra cosa è stato venduto');
    console.log('   ⚠️  Può includere ordini non ancora fatturati');

    console.log('\n2. FATTURE (account.move):');
    console.log('   ✅ Rappresentano il fatturato ufficiale');
    console.log('   ✅ Dato contabile preciso');
    console.log('   ⚠️  Può mancare del margine prodotto dettagliato');
    console.log('   ⚠️  Non sempre riflette i regali/omaggi\n');

    console.log('💡 RACCOMANDAZIONE:');
    console.log('   Per una dashboard margini → USA ORDINI (sale.order)');
    console.log('   Per fatturato contabile → USA FATTURE (account.move)');
    console.log('   IDEALE: Dashboard che mostra ENTRAMBI!\n');

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
