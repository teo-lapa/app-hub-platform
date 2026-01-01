/**
 * Analisi SEO Blog Articles
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
  console.log('Connessione a Odoo...');

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

  console.log('Caricamento articoli blog...');

  // Get ALL blog posts
  const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: {
        model: 'blog.post',
        method: 'search_read',
        args: [],
        kwargs: {
          domain: [['is_published', '=', true]],
          fields: ['id', 'name', 'website_meta_title', 'website_meta_description', 'website_meta_keywords', 'subtitle'],
          limit: 500
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  const articles = data.result || [];

  console.log('Trovati ' + articles.length + ' articoli pubblicati');
  console.log('');

  // Analisi
  let hasTitle = 0;
  let hasDesc = 0;
  let hasKeywords = 0;
  let hasB2BKeywords = 0;
  let hasLocationKeywords = 0;

  const B2B_KEYWORDS = ['fornitore', 'grossista', 'ristorante', 'pizzeria', 'hotel', 'horeca', 'aprire', 'supplier'];
  const LOCATION_KEYWORDS = ['zurigo', 'zurich', 'basilea', 'basel', 'berna', 'bern', 'ginevra', 'genf', 'lugano', 'svizzera', 'schweiz'];

  const goodArticles: any[] = [];
  const needsWork: any[] = [];

  for (const a of articles) {
    const title = (a.website_meta_title || '').toLowerCase();
    const desc = (a.website_meta_description || '').toLowerCase();
    const kw = (a.website_meta_keywords || '').toLowerCase();
    const name = (a.name || '').toLowerCase();
    const combined = title + ' ' + desc + ' ' + kw + ' ' + name;

    const hasTitleOK = title.length >= 20;
    const hasDescOK = desc.length >= 50;
    const hasKwOK = kw.length > 5;

    if (hasTitleOK) hasTitle++;
    if (hasDescOK) hasDesc++;
    if (hasKwOK) hasKeywords++;

    const hasB2B = B2B_KEYWORDS.some(k => combined.includes(k));
    const hasLoc = LOCATION_KEYWORDS.some(k => combined.includes(k));

    if (hasB2B) hasB2BKeywords++;
    if (hasLoc) hasLocationKeywords++;

    if (hasTitleOK && hasDescOK && hasKwOK && (hasB2B || hasLoc)) {
      if (goodArticles.length < 5) {
        goodArticles.push({
          id: a.id,
          name: a.name,
          title: a.website_meta_title,
          hasB2B, hasLoc
        });
      }
    } else if (needsWork.length < 10) {
      needsWork.push({
        id: a.id,
        name: a.name,
        title: a.website_meta_title || '(vuoto)',
        desc: desc.length,
        kw: kw.length
      });
    }
  }

  const total = articles.length;

  console.log('='.repeat(70));
  console.log('  ANALISI SEO ARTICOLI BLOG');
  console.log('='.repeat(70));
  console.log('');
  console.log('Totale articoli pubblicati: ' + total);
  console.log('');
  console.log('META TAG COMPLETEZZA');
  console.log('-'.repeat(70));
  console.log('Con Meta Title OK:        ' + hasTitle + '/' + total + ' (' + ((hasTitle/total)*100).toFixed(1) + '%)');
  console.log('Con Meta Description OK:  ' + hasDesc + '/' + total + ' (' + ((hasDesc/total)*100).toFixed(1) + '%)');
  console.log('Con Keywords:             ' + hasKeywords + '/' + total + ' (' + ((hasKeywords/total)*100).toFixed(1) + '%)');
  console.log('');
  console.log('KEYWORD STRATEGICHE');
  console.log('-'.repeat(70));
  console.log('Con keyword B2B (fornitore, grossista, ristorante): ' + hasB2BKeywords + ' (' + ((hasB2BKeywords/total)*100).toFixed(1) + '%)');
  console.log('Con keyword localita (zurigo, basilea, svizzera):   ' + hasLocationKeywords + ' (' + ((hasLocationKeywords/total)*100).toFixed(1) + '%)');
  console.log('');

  if (goodArticles.length > 0) {
    console.log('ARTICOLI CON SEO OTTIMALE:');
    console.log('-'.repeat(70));
    for (const a of goodArticles) {
      console.log('   ID ' + a.id + ': ' + a.name.substring(0, 50));
      console.log('   Title: ' + a.title);
      console.log('   B2B: ' + (a.hasB2B ? 'Si' : 'No') + ' | Location: ' + (a.hasLoc ? 'Si' : 'No'));
      console.log('');
    }
  }

  if (needsWork.length > 0) {
    console.log('ARTICOLI DA MIGLIORARE:');
    console.log('-'.repeat(70));
    for (const a of needsWork) {
      console.log('   ID ' + a.id + ': ' + a.name.substring(0, 50));
      console.log('   Title: ' + a.title.substring(0, 50));
      console.log('   Desc len: ' + a.desc + ' | Kw len: ' + a.kw);
      console.log('');
    }
  }

  console.log('='.repeat(70));
}

main();
