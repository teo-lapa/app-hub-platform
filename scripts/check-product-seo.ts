/**
 * Verifica SEO di un prodotto specifico
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function searchRead(model: string, domain: any[], fields: string[], limit?: number): Promise<any[]> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [domain],
        kwargs: { fields, limit: limit || 10 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  console.log('🔍 VERIFICA SEO PRODOTTO');
  console.log('='.repeat(60));

  await authenticate();

  // Cerca il prodotto "Fiordilatte julienne" dallo screenshot
  const products = await searchRead('product.template',
    [['name', 'ilike', 'julienne']],
    ['id', 'name', 'website_url', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'],
    5
  );

  console.log(`\n📦 Trovati ${products.length} prodotti con "julienne":\n`);

  for (const p of products) {
    console.log('─'.repeat(60));
    console.log(`📦 PRODOTTO: ${p.name}`);
    console.log(`🔗 URL: ${p.website_url}`);
    console.log('');
    console.log(`📝 META TITLE:`);
    console.log(`   ${p.website_meta_title || '❌ MANCANTE'}`);
    console.log('');
    console.log(`📝 META DESCRIPTION:`);
    console.log(`   ${p.website_meta_description || '❌ MANCANTE'}`);
    console.log('');
    console.log(`🏷️ KEYWORDS:`);
    console.log(`   ${p.website_meta_keywords || '❌ MANCANTE'}`);
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log('\n💡 Questi meta tag dovrebbero apparire nel <head> della pagina HTML');
  console.log('   quando visiti il prodotto su lapa.ch');
}

main();
