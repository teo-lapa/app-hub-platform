require('dotenv').config({ path: '.env.local' });

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_LOGIN = process.env.ODOO_LOGIN;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

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
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error('❌ Errore Odoo:', JSON.stringify(data.error, null, 2));
    throw new Error(JSON.stringify(data.error));
  }
  return data.result;
}

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD }
    })
  });

  const setCookie = response.headers.get('set-cookie');
  return setCookie;
}

async function main() {
  console.log('🔐 Autenticazione...');
  const cookies = await authenticate();

  console.log('🔍 Cerco picking WH/OUT/34443...');
  const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [[
    ['name', '=', 'WH/OUT/34443']
  ]], { fields: ['id', 'name'] });

  const pickingId = pickings[0].id;
  console.log(`✅ Picking ID: ${pickingId}\n`);

  console.log('📦 Leggo UNA stock.move.line per vedere TUTTI i campi disponibili...');
  const moveLines = await callOdoo(cookies, 'stock.move.line', 'search_read', [[
    ['picking_id', '=', pickingId]
  ]], {
    fields: [],  // Vuoto = prende TUTTI i campi!
    limit: 1
  });

  if (moveLines.length === 0) {
    console.log('❌ Nessuna move_line trovata');
    return;
  }

  console.log('\n📋 TUTTI I CAMPI DISPONIBILI su stock.move.line:');
  console.log('='.repeat(80));

  const fields = Object.keys(moveLines[0]).sort();
  fields.forEach(field => {
    const value = moveLines[0][field];
    const type = Array.isArray(value) ? 'array' : typeof value;
    console.log(`  ${field.padEnd(30)} = ${JSON.stringify(value)} (${type})`);
  });

  console.log('\n🎯 CAMPI INTERESSANTI per quantità:');
  const qtyFields = fields.filter(f =>
    f.includes('qty') || f.includes('quantity') || f.includes('reserved')
  );
  qtyFields.forEach(field => {
    console.log(`  ✓ ${field} = ${moveLines[0][field]}`);
  });
}

main().catch(console.error);
