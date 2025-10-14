/**
 * Come risalire all'ordine usando il campo "origin"?
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859';

async function login() {
  const resp = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: 'paul@lapa.ch', password: 'lapa201180' },
      id: 1
    })
  });

  const cookies = resp.headers.get('set-cookie') || '';
  const match = cookies.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
}

async function odooCall(sessionId, model, method, args, kwargs = {}) {
  const resp = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.random()
    })
  });

  const data = await resp.json();
  if (data.error) {
    console.error('❌ Errore:', data.error.data.message);
    return null;
  }
  return data.result;
}

async function main() {
  const sid = await login();
  console.log('✅ Login OK\n');

  console.log('🔍 Cerco ordine con nome "S00015"...\n');

  const orders = await odooCall(sid, 'sale.order', 'search_read', [[
    ['name', '=', 'S00015']
  ]], {
    fields: ['id', 'name', 'partner_id', 'commitment_date', 'date_order', 'state'],
    limit: 1
  });

  if (orders && orders.length > 0) {
    const order = orders[0];
    console.log('✅ TROVATO ORDINE:');
    console.log(`   Ordine: ${order.name}`);
    console.log(`   Cliente: ${order.partner_id[1]}`);
    console.log(`   Data consegna: ${order.commitment_date || order.date_order}`);
    console.log(`   Stato: ${order.state}\n`);
  } else {
    console.log('❌ Ordine S00015 non trovato\n');
  }

  console.log('💡 STRATEGIA:');
  console.log('   1. Cerco stock.move con location_dest_id = furgoni');
  console.log('   2. Per ogni move, prendo il campo "origin" (es: S00015)');
  console.log('   3. Cerco sale.order con name = origin');
  console.log('   4. Da sale.order prendo cliente e data consegna\n');
}

main();
