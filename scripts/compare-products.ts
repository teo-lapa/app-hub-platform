/**
 * Confronta prodotti accessibili vs 404
 */
const ODOO_CONFIG = {
  url: 'https://www.lapa.ch',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let cookies: string | null = null;

async function auth() {
  const res = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { db: ODOO_CONFIG.db, login: ODOO_CONFIG.username, password: ODOO_CONFIG.password },
      id: 1
    })
  });
  const cookieHeader = res.headers.get('set-cookie');
  if (cookieHeader) cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  const data = await res.json();
  if (!cookies) cookies = `session_id=${data.result.session_id}`;
}

async function getProduct(id: number) {
  const res = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: {
        model: 'product.template',
        method: 'search_read',
        args: [],
        kwargs: {
          domain: [['id', '=', id]],
          fields: ['id', 'name', 'website_url', 'is_published', 'active', 'sale_ok',
                   'website_published', 'categ_id', 'public_categ_ids']
        }
      },
      id: 2
    })
  });
  const data = await res.json();
  return data.result?.[0];
}

async function main() {
  await auth();
  console.log('✅ Connesso\n');

  // Prodotto FUNZIONANTE (burrata 13198)
  const working = await getProduct(13198);

  // Prodotto 404 (apolline 23232)
  const notWorking = await getProduct(23232);

  console.log('📗 PRODOTTO FUNZIONANTE (burrata 13198):');
  console.log(JSON.stringify(working, null, 2));

  console.log('\n📕 PRODOTTO 404 (apolline 23232):');
  console.log(JSON.stringify(notWorking, null, 2));

  console.log('\n\n🔍 DIFFERENZE:');
  if (working && notWorking) {
    const keys = ['is_published', 'active', 'sale_ok', 'website_published', 'public_categ_ids'];
    for (const key of keys) {
      const w = JSON.stringify(working[key]);
      const nw = JSON.stringify(notWorking[key]);
      if (w !== nw) {
        console.log(`  ${key}: WORKING=${w} vs 404=${nw}`);
      }
    }
  }
}

main().catch(console.error);
