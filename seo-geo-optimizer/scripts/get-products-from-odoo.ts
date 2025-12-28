/**
 * Get products from Odoo to associate with articles
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate(): Promise<number> {
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
  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
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
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message);
  }
  return data.result;
}

async function getProducts() {
  console.log('🔐 Authenticating...');
  await authenticate();

  console.log('📦 Fetching ALL published products in batches...\n');

  // First, get the count
  const totalCount = await callOdoo('product.template', 'search_count', [
    [['website_published', '=', true]]
  ], {});

  console.log(`📊 Total published products: ${totalCount}\n`);

  // Fetch in batches of 500
  const batchSize = 500;
  const products: any[] = [];

  for (let offset = 0; offset < totalCount; offset += batchSize) {
    console.log(`   Fetching batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(totalCount / batchSize)} (${offset + 1}-${Math.min(offset + batchSize, totalCount)})...`);

    const batch = await callOdoo('product.template', 'search_read', [
      [['website_published', '=', true]],
      ['id', 'name', 'list_price', 'website_url', 'image_512']
    ], { limit: batchSize, offset });

    products.push(...batch);

    // Small delay between batches
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Downloaded ${products.length} products\n`);

  // Save to file
  const fs = await import('fs');
  fs.writeFileSync(
    'data/odoo-products-catalog.json',
    JSON.stringify(products, null, 2)
  );

  console.log('💾 Saved to data/odoo-products-catalog.json');

  return products;
}

getProducts().catch(console.error);
