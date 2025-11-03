/**
 * Test periodi dashboard margini
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

let sessionCookies = '';

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD }
    })
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    sessionCookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
  }
  const data = await response.json();
  console.log('✅ Autenticato!\n');
  return data.result;
}

async function callOdoo(model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookies },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs } })
  });
  const data = await response.json();
  return data.result;
}

function getDateRange(period) {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0] + ' 23:59:59';
      break;

    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = monthStart.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0] + ' 23:59:59';
      break;

    case 'quarter':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      startDate = quarterStart.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0] + ' 23:59:59';
      break;

    default:
      startDate = '2025-10-01';
      endDate = '2025-10-31 23:59:59';
  }

  return { startDate, endDate };
}

async function testPeriod(period) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST PERIODO: ${period.toUpperCase()}`);
  console.log('='.repeat(80));

  const { startDate, endDate } = getDateRange(period);
  console.log(`📅 Range: ${startDate} - ${endDate}\n`);

  // Ordini
  const orders = await callOdoo('sale.order', 'search_read', [[
    ['date_order', '>=', startDate],
    ['date_order', '<=', endDate],
    ['state', 'in', ['sale', 'done']]
  ]], { fields: ['order_line'] });

  console.log(`📦 Ordini trovati: ${orders.length}`);

  if (orders.length === 0) {
    console.log('⚠️  Nessun dato per questo periodo\n');
    return;
  }

  const orderLineIds = orders.flatMap(o => o.order_line || []);
  const lines = await callOdoo('sale.order.line', 'search_read', [[['id', 'in', orderLineIds]]], {
    fields: ['product_id', 'price_subtotal', 'purchase_price', 'product_uom_qty']
  });

  console.log(`📋 Righe ordine: ${lines.length}`);

  // Conta prodotti regalati
  const gifted = lines.filter(l => (l.price_subtotal || 0) === 0 && ((l.purchase_price || 0) * (l.product_uom_qty || 0)) > 0);
  console.log(`🎁 Prodotti regalati: ${gifted.length} righe`);

  // Calcola margini
  let totalRevenue = 0, totalCost = 0;
  lines.forEach(l => {
    totalRevenue += l.price_subtotal || 0;
    totalCost += (l.purchase_price || 0) * (l.product_uom_qty || 0);
  });

  const totalMargin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(2) : 0;

  console.log(`\n💰 RIEPILOGO:`);
  console.log(`   Fatturato: CHF ${totalRevenue.toFixed(2)}`);
  console.log(`   Costo:     CHF ${totalCost.toFixed(2)}`);
  console.log(`   Margine:   CHF ${totalMargin.toFixed(2)} (${marginPct}%)`);
}

async function main() {
  try {
    await authenticate();

    await testPeriod('week');
    await testPeriod('month');
    await testPeriod('quarter');
    await testPeriod('october'); // Ottobre con molti dati

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETATO');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
  }
}

main();
