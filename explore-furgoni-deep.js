/**
 * Esplorazione approfondita: cerco TUTTE le ubicazioni figlie di "Furgoni"
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

async function searchChildLocations(sessionId, parentId) {
  console.log(`\n🔍 Cerco ubicazioni FIGLIE dell'ubicazione ID ${parentId}...\n`);

  const resp = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'stock.location',
        method: 'search_read',
        args: [[
          ['location_id', '=', parentId]
        ]],
        kwargs: {
          fields: ['id', 'name', 'complete_name', 'barcode'],
          limit: 50
        }
      },
      id: 2
    })
  });

  const data = await resp.json();
  const locs = data.result || [];

  if (locs.length === 0) {
    console.log('❌ Nessuna ubicazione figlia trovata');
    return [];
  }

  console.log(`✅ Trovate ${locs.length} ubicazioni figlie:\n`);
  locs.forEach((loc, i) => {
    console.log(`${i+1}. ${loc.complete_name}`);
    console.log(`   ID: ${loc.id} | Name: ${loc.name} | Barcode: ${loc.barcode || 'N/A'}\n`);
  });

  return locs;
}

async function main() {
  const sid = await login();
  console.log(`✅ Login OK`);

  // ID 11 è "WH/Furgoni"
  const children = await searchChildLocations(sid, 11);

  if (children.length > 0) {
    console.log(`\n💡 SCOPERTA: Ci sono ${children.length} furgoni INDIVIDUALI sotto "WH/Furgoni"`);
    console.log('📝 L\'APP deve mostrare questi furgoni specifici, non il parent!\n');
  } else {
    console.log('\n💡 NON ci sono furgoni individuali.');
    console.log('📝 L\'APP deve mostrare solo "WH/Furgoni" come unico furgone\n');
  }
}

main();
