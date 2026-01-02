/**
 * Verifica completa keyword tedesche + geografiche
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
          fields: ['id', 'name', 'website_meta_keywords'],
          limit: 5000
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  const products = data.result || [];
  const total = products.length;

  // German keywords
  const germanKw = ['kaufen', 'bestellen', 'online', 'lieferung', 'grosshandel'];

  // Location keywords
  const locations = [
    'zürich', 'bern', 'basel', 'luzern', 'st. gallen',
    'winterthur', 'zug', 'thurgau', 'aargau', 'schaffhausen',
    'schwyz', 'solothurn', 'glarus', 'chur', 'graubünden',
    'lugano', 'ticino', 'bellinzona', 'locarno', 'mendrisio'
  ];

  const germanCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};

  germanKw.forEach(k => germanCounts[k] = 0);
  locations.forEach(l => locationCounts[l] = 0);

  for (const p of products) {
    const kw = (p.website_meta_keywords || '').toLowerCase();

    germanKw.forEach(k => {
      if (kw.includes(k)) germanCounts[k]++;
    });

    locations.forEach(l => {
      if (kw.includes(l)) locationCounts[l]++;
    });
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('  VERIFICA COMPLETA SEO - LAPA.CH');
  console.log('='.repeat(70));
  console.log('');
  console.log('Totale prodotti pubblicati: ' + total);
  console.log('');
  console.log('KEYWORD TEDESCHE TRANSAZIONALI:');
  console.log('-'.repeat(70));
  germanKw.forEach(k => {
    const count = germanCounts[k];
    const pct = ((count/total)*100).toFixed(1);
    console.log(`  ${k.padEnd(15)} ${count} prodotti (${pct}%)`);
  });

  console.log('');
  console.log('KEYWORD GEOGRAFICHE SVIZZERE:');
  console.log('-'.repeat(70));
  locations.forEach(l => {
    const count = locationCounts[l];
    const pct = ((count/total)*100).toFixed(1);
    console.log(`  ${l.padEnd(15)} ${count} prodotti (${pct}%)`);
  });

  // Show example
  const example = products.find((p: any) => {
    const kw = (p.website_meta_keywords || '').toLowerCase();
    return kw.includes('kaufen') && kw.includes('zürich');
  });

  if (example) {
    console.log('');
    console.log('ESEMPIO PRODOTTO CON TUTTE LE KEYWORD:');
    console.log('-'.repeat(70));
    console.log('Nome: ' + example.name);
    console.log('Keywords: ' + example.website_meta_keywords);
  }
  console.log('');
}

main();
