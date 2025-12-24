/**
 * Check SEO status of ALL published products
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

  // Get ALL published products
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
          fields: ['id', 'name', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'],
          limit: 5000
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  const products = data.result || [];

  // Analyze
  let noTitle = 0, noDesc = 0, noKeywords = 0;
  let goodTitle = 0, goodDesc = 0;
  let perfect = 0;

  const needsWork: any[] = [];
  const hasGoodSeo: any[] = [];

  for (const p of products) {
    const hasTitle = p.website_meta_title && p.website_meta_title.trim().length > 5;
    const hasDesc = p.website_meta_description && p.website_meta_description.trim().length > 20;
    const hasKw = p.website_meta_keywords && p.website_meta_keywords.trim().length > 5;

    // Check quality
    const titleLen = (p.website_meta_title || '').length;
    const descLen = (p.website_meta_description || '').length;
    const titleOk = hasTitle && titleLen >= 30 && titleLen <= 65;
    const descOk = hasDesc && descLen >= 100 && descLen <= 170;

    if (!hasTitle) noTitle++;
    else if (titleOk) goodTitle++;

    if (!hasDesc) noDesc++;
    else if (descOk) goodDesc++;

    if (!hasKw) noKeywords++;

    if (titleOk && descOk && hasKw) {
      perfect++;
      if (hasGoodSeo.length < 3) {
        hasGoodSeo.push({
          id: p.id,
          name: p.name,
          title: p.website_meta_title,
          desc: p.website_meta_description
        });
      }
    }

    // Collect products that need work
    if (needsWork.length < 10 && (!hasTitle || !hasDesc || !hasKw)) {
      needsWork.push({
        id: p.id,
        name: p.name,
        title: p.website_meta_title || null,
        desc: p.website_meta_description || null,
        kw: p.website_meta_keywords || null
      });
    }
  }

  console.log('='.repeat(70));
  console.log('STATO SEO - TUTTI I PRODOTTI PUBBLICATI');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Totale prodotti pubblicati: ${products.length}`);
  console.log('');
  console.log('STATISTICHE:');
  console.log('-'.repeat(70));
  console.log(`SEO Perfetto (title+desc+kw corretti): ${perfect} (${(perfect/products.length*100).toFixed(1)}%)`);
  console.log(`Prodotti DA SISTEMARE:                 ${products.length - perfect} (${((products.length-perfect)/products.length*100).toFixed(1)}%)`);
  console.log('');
  console.log('DETTAGLIO PROBLEMI:');
  console.log('-'.repeat(70));
  console.log(`Senza Meta Title:       ${noTitle} prodotti`);
  console.log(`Senza Meta Description: ${noDesc} prodotti`);
  console.log(`Senza Keywords:         ${noKeywords} prodotti`);
  console.log(`Con Title OK:           ${goodTitle} prodotti`);
  console.log(`Con Description OK:     ${goodDesc} prodotti`);
  console.log('');

  if (hasGoodSeo.length > 0) {
    console.log('ESEMPI PRODOTTI CON SEO OK:');
    console.log('-'.repeat(70));
    for (const p of hasGoodSeo) {
      console.log(`ID ${p.id}: ${p.name.substring(0, 50)}`);
      console.log(`   Title: ${p.title}`);
      console.log(`   Desc:  ${p.desc.substring(0, 70)}...`);
      console.log('');
    }
  }

  console.log('ESEMPI PRODOTTI DA SISTEMARE:');
  console.log('-'.repeat(70));
  for (const p of needsWork.slice(0, 5)) {
    console.log(`ID ${p.id}: ${p.name.substring(0, 50)}`);
    console.log(`   Title: ${p.title || '(VUOTO)'}`);
    console.log(`   Desc:  ${p.desc ? p.desc.substring(0, 50) + '...' : '(VUOTO)'}`);
    console.log(`   Kw:    ${p.kw ? 'OK' : '(VUOTO)'}`);
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('CONCLUSIONE:');
  console.log('='.repeat(70));
  const toFix = products.length - perfect;
  console.log(`${toFix} prodotti hanno bisogno di SEO ottimizzato come Friarielli`);
}

main();
