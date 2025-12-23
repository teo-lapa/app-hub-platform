/**
 * Cancella TUTTI gli articoli di test (162-171)
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: Date.now()
    })
  });

  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }

  return (await response.json()).result.uid;
}

async function callOdoo(model, method, args, kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Date.now()
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  console.log('🗑️  CANCELLAZIONE COMPLETA ARTICOLI DI TEST\n');

  await authenticate();

  // IDs da cancellare: 162-171
  const idsToDelete = [162, 163, 164, 165, 166, 167, 168, 169, 170, 171];

  console.log(`Cancellazione di ${idsToDelete.length} articoli...\n`);

  for (const id of idsToDelete) {
    try {
      await callOdoo('blog.post', 'unlink', [[id]]);
      console.log(`✓ Eliminato ID ${id}`);
    } catch (e) {
      console.log(`✗ Errore ID ${id}: ${e.message.substring(0, 50)}`);
    }
  }

  console.log('\n✅ Pulizia completata!\n');
}

main().catch(console.error);
