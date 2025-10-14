/**
 * Script per esplorare Odoo Staging e capire la struttura delle ubicazioni furgoni
 * Usa una sessione ottenuta tramite login
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859';

async function loginToOdoo() {
  console.log('🔐 Login su Odoo staging...');

  const loginResp = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: 'paul@lapa.ch',
        password: 'lapa201180'
      },
      id: Math.random()
    })
  });

  const loginData = await loginResp.json();

  // Estrai session_id dai cookies
  const cookies = loginResp.headers.get('set-cookie') || '';
  const sessionMatch = cookies.match(/session_id=([^;]+)/);
  const sessionId = sessionMatch ? sessionMatch[1] : null;

  if (!sessionId && loginData.result && loginData.result.session_id) {
    return loginData.result.session_id;
  }

  if (!sessionId) {
    console.error('❌ Login fallito!');
    console.log('Risposta:', JSON.stringify(loginData, null, 2));
    throw new Error('No session');
  }

  console.log('✅ Login OK! Session:', sessionId.substring(0, 20) + '...');
  return sessionId;
}

async function searchFurgoniLocations(sessionId) {
  console.log('\n📍 Cerco ubicazioni furgoni...\n');

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
          ['complete_name', 'ilike', 'FURGON']
        ]],
        kwargs: {
          fields: ['id', 'name', 'complete_name', 'barcode', 'usage', 'location_id'],
          limit: 20
        }
      },
      id: Math.random()
    })
  });

  const data = await resp.json();

  if (data.error) {
    console.error('❌ Errore:', data.error.data.message);
    return [];
  }

  const locs = data.result || [];
  console.log(`✅ Trovate ${locs.length} ubicazioni furgoni:\n`);

  locs.forEach((loc, i) => {
    console.log(`${i+1}. ${loc.complete_name}`);
    console.log(`   ID: ${loc.id} | Barcode: ${loc.barcode || 'N/A'}`);
  });

  return locs;
}

async function getProductsInLocation(sessionId, locationId, locationName) {
  console.log(`\n📦 Prodotti in "${locationName}"...\n`);

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
        model: 'stock.quant',
        method: 'search_read',
        args: [[
          ['location_id', '=', locationId],
          ['quantity', '>', 0]
        ]],
        kwargs: {
          fields: ['product_id', 'quantity', 'reserved_quantity', 'lot_id'],
          limit: 5
        }
      },
      id: Math.random()
    })
  });

  const data = await resp.json();

  if (data.error) {
    console.error('❌ Errore:', data.error.data.message);
    return;
  }

  const quants = data.result || [];
  console.log(`✅ Trovati ${quants.length} prodotti:\n`);

  quants.forEach((q, i) => {
    const avail = q.quantity - (q.reserved_quantity || 0);
    console.log(`${i+1}. ${q.product_id[1]}`);
    console.log(`   Qtà: ${q.quantity} | Disponibile: ${avail}`);
    if (q.lot_id) console.log(`   Lotto: ${q.lot_id[1]}`);
  });
}

async function main() {
  try {
    const sessionId = await loginToOdoo();
    const locations = await searchFurgoniLocations(sessionId);

    if (locations.length > 0) {
      await getProductsInLocation(sessionId, locations[0].id, locations[0].name);
    }

    console.log('\n\n✅ ESPLORAZIONE COMPLETATA!');
    console.log('📝 Ora posso scrivere l\'API con i dati reali!\n');

  } catch (err) {
    console.error('\n❌ ERRORE:', err.message);
    console.error(err.stack);
  }
}

main();
