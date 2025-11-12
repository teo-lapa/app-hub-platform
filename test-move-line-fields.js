require('dotenv').config({ path: '.env.local' });
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = process.env.ODOO_LOGIN;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const setCookie = response.headers.get('set-cookie');
  const sessionId = setCookie?.match(/session_id=([^;]+)/)?.[1];

  return sessionId;
}

async function callOdoo(sessionId, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  console.log('🔐 Autenticazione...');
  const sessionId = await authenticate();

  console.log('🔍 Cerco picking WH/OUT/34443...');
  const pickings = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
    ['name', '=', 'WH/OUT/34443']
  ]], { fields: ['id', 'name'] });

  if (pickings.length === 0) {
    console.log('❌ Picking non trovato');
    return;
  }

  const pickingId = pickings[0].id;
  console.log(`✅ Picking trovato: ID ${pickingId}`);

  console.log('\n📦 Leggo stock.move.line...');

  // Prima prova: leggo TUTTI i campi disponibili
  const moveLines = await callOdoo(sessionId, 'stock.move.line', 'search_read', [[
    ['picking_id', '=', pickingId]
  ]], { fields: [], limit: 1 });

  console.log('\n📋 TUTTI I CAMPI disponibili su stock.move.line:');
  console.log(JSON.stringify(moveLines[0], null, 2));
}

main().catch(console.error);
