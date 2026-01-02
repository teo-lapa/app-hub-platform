/**
 * Verifica keyword tedesche aggiunte
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
  // Auth
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

  // Get products
  const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
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
          fields: ['id', 'name', 'website_meta_keywords', 'website_meta_description'],
          limit: 5000
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  const products = data.result || [];

  let hasKaufen = 0;
  let hasBestellen = 0;
  let hasOnline = 0;
  let hasLieferung = 0;
  let hasGrosshandel = 0;

  for (const p of products) {
    const kw = (p.website_meta_keywords || '').toLowerCase();
    const desc = (p.website_meta_description || '').toLowerCase();
    const combined = kw + ' ' + desc;

    if (combined.includes('kaufen')) hasKaufen++;
    if (combined.includes('bestellen')) hasBestellen++;
    if (combined.includes('online')) hasOnline++;
    if (combined.includes('lieferung')) hasLieferung++;
    if (combined.includes('grosshandel')) hasGrosshandel++;
  }

  const total = products.length;

  console.log('');
  console.log('='.repeat(70));
  console.log('  VERIFICA KEYWORD TEDESCHE - DOPO AGGIORNAMENTO');
  console.log('='.repeat(70));
  console.log('');
  console.log('Totale prodotti: ' + total);
  console.log('');
  console.log('KEYWORD TEDESCHE PRESENTI:');
  console.log('-'.repeat(70));
  console.log('kaufen:      ' + hasKaufen + ' prodotti (' + ((hasKaufen/total)*100).toFixed(1) + '%)');
  console.log('bestellen:   ' + hasBestellen + ' prodotti (' + ((hasBestellen/total)*100).toFixed(1) + '%)');
  console.log('online:      ' + hasOnline + ' prodotti (' + ((hasOnline/total)*100).toFixed(1) + '%)');
  console.log('lieferung:   ' + hasLieferung + ' prodotti (' + ((hasLieferung/total)*100).toFixed(1) + '%)');
  console.log('grosshandel: ' + hasGrosshandel + ' prodotti (' + ((hasGrosshandel/total)*100).toFixed(1) + '%)');
  console.log('');

  // Mostra esempio
  const example = products.find((p: any) => (p.website_meta_keywords || '').toLowerCase().includes('kaufen'));
  if (example) {
    console.log('ESEMPIO PRODOTTO AGGIORNATO:');
    console.log('-'.repeat(70));
    console.log('Nome: ' + example.name);
    console.log('Keywords: ' + example.website_meta_keywords);
    console.log('Description: ' + (example.website_meta_description || '').substring(0, 100) + '...');
  }
  console.log('');
}

main();
