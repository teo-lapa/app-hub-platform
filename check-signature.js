// Verifica se il picking ID 1 ha la firma salvata
const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24063382';
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

async function checkSignature() {
  // Autentica
  const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD }
    })
  });

  const authData = await authResponse.json();
  const setCookie = authResponse.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
  const cookies = `session_id=${sessionMatch[1]}`;

  console.log('✅ Autenticato, uid:', authData.result.uid);

  // Leggi il picking ID 1
  const pickingResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'stock.picking',
        method: 'read',
        args: [[1], ['id', 'name', 'signature', 'state']],
        kwargs: {}
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const pickingData = await pickingResponse.json();
  const picking = pickingData.result[0];

  console.log('\n📦 Picking ID 1:');
  console.log('  Nome:', picking.name);
  console.log('  Stato:', picking.state);
  console.log('  Ha firma:', picking.signature ? '✅ SI' : '❌ NO');

  if (picking.signature) {
    console.log('  Lunghezza firma (base64):', picking.signature.length, 'caratteri');
    console.log('  Preview firma (primi 100 char):', picking.signature.substring(0, 100) + '...');
  }
}

checkSignature().catch(console.error);
