const ODOO_CONFIG = {
  url: 'https://www.lapa.ch',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let cookies: string | null = null;

async function main() {
  // Auth
  const authRes = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_CONFIG.db, login: ODOO_CONFIG.username, password: ODOO_CONFIG.password },
      id: 1
    })
  });

  const cookieHeader = authRes.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }

  const authData = await authRes.json();
  if (!cookies) cookies = `session_id=${authData.result.session_id}`;

  console.log('✅ Connesso\n');

  // Get product with website_url
  const res = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'product.template',
        method: 'search_read',
        args: [],
        kwargs: {
          domain: [['is_published', '=', true]],
          fields: ['id', 'name', 'website_url', 'is_published', 'website_id'],
          limit: 5
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  console.log('Prodotti pubblicati:');
  for (const p of data.result || []) {
    console.log(`  ID: ${p.id}`);
    console.log(`  Nome: ${p.name}`);
    console.log(`  URL: ${p.website_url}`);
    console.log(`  Website ID: ${p.website_id ? p.website_id[0] : 'NESSUNO!'}`);
    console.log(`  Pubblicato: ${p.is_published}`);
    console.log('---');
  }
}

main().catch(console.error);
