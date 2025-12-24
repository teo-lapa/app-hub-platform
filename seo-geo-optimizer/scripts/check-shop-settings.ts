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

  // Check website settings
  const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: {
        model: 'website',
        method: 'search_read',
        args: [],
        kwargs: {
          domain: [],
          fields: ['id', 'name', 'shop_default_sort', 'shop_ppg', 'shop_ppr'],
          limit: 5
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  console.log('Website settings:', JSON.stringify(data.result, null, 2));

  // Check top selling products
  const salesRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
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
          fields: ['id', 'name', 'sales_count', 'website_sequence'],
          order: 'sales_count desc',
          limit: 10
        }
      },
      id: 3
    })
  });

  const salesData = await salesRes.json();
  console.log('\nTop 10 products by sales_count:');
  for (const p of salesData.result || []) {
    console.log(`  ${p.sales_count || 0} sales - ${p.name.substring(0, 50)} (seq: ${p.website_sequence})`);
  }
}
main();
