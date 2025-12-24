/**
 * Set shop to show best sellers first
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL!;
const ODOO_DB = process.env.ODOO_DB!;
const ODOO_USERNAME = process.env.ODOO_USERNAME!;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD!;

async function main() {
  console.log('='.repeat(60));
  console.log('CONFIGURING SHOP - BEST SELLERS FIRST');
  console.log('='.repeat(60));

  const authRes = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: 1
    })
  });
  const cookies = authRes.headers.get('set-cookie')?.split(',').map(c => c.split(';')[0].trim()).join('; ');
  console.log('\nConnected to Odoo');

  // Update website 1 (LAPA ZERO PENSIERI - main site)
  const updateRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: {
        model: 'website',
        method: 'write',
        args: [[1], {
          shop_default_sort: 'sales_count desc'  // Best sellers first
        }],
        kwargs: {}
      },
      id: 2
    })
  });

  const updateData = await updateRes.json();
  if (updateData.error) {
    console.log('\nError:', updateData.error.message);

    // Try alternative sort field
    console.log('\nTrying alternative: website_sequence...');

    // Instead, we'll update the website_sequence based on sales
    const productsRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call',
        params: {
          model: 'product.template',
          method: 'search_read',
          args: [],
          kwargs: {
            domain: [['is_published', '=', true]],
            fields: ['id', 'name', 'sales_count'],
            order: 'sales_count desc',
            limit: 5000
          }
        },
        id: 3
      })
    });

    const products = (await productsRes.json()).result || [];
    console.log(`\nFound ${products.length} products`);
    console.log('Updating website_sequence based on sales...\n');

    let updated = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const newSequence = i + 1; // 1 = most sold, 2 = second most, etc.

      const writeRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'call',
          params: {
            model: 'product.template',
            method: 'write',
            args: [[p.id], { website_sequence: newSequence }],
            kwargs: {}
          },
          id: Date.now()
        })
      });

      updated++;
      if (updated % 100 === 0) {
        console.log(`Updated ${updated}/${products.length} products...`);
      }
    }

    console.log(`\nDone! Updated ${updated} products`);
    console.log('\nTop 10 products will now be:');
    for (let i = 0; i < Math.min(10, products.length); i++) {
      console.log(`${i + 1}. ${products[i].name.substring(0, 50)} (${products[i].sales_count} sales)`);
    }

  } else {
    console.log('\nShop default sort changed to: sales_count desc (Best Sellers)');
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE!');
  console.log('='.repeat(60));
}

main();
