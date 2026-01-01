/**
 * Analisi del "Modello Vincente" SEO
 * Verifica se i prodotti usano keyword transazionali (kaufen, buy, online, comprare)
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

// Keyword transazionali vincenti
const TRANSACTIONAL_KEYWORDS = {
  german: ['kaufen', 'bestellen', 'online', 'shop', 'lieferung', 'schweiz'],
  italian: ['comprare', 'acquistare', 'online', 'ordina', 'svizzera', 'consegna'],
  english: ['buy', 'order', 'online', 'shop', 'delivery', 'switzerland'],
  french: ['acheter', 'commander', 'en ligne', 'livraison', 'suisse']
};

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

  console.log('Caricamento prodotti...');

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
          fields: ['id', 'name', 'website_meta_title', 'website_meta_description', 'website_meta_keywords', 'default_code'],
          limit: 5000
        }
      },
      id: 2
    })
  });

  const data = await res.json();
  const products = data.result || [];

  console.log(`Analisi di ${products.length} prodotti...`);
  console.log('');

  // Analisi dettagliata
  let hasTransactional = 0;
  let hasGermanKw = 0;
  let hasItalianKw = 0;
  let hasEnglishKw = 0;
  let hasBrandInTitle = 0;
  let hasLAPA = 0;
  let hasSwissContext = 0;

  const perfect: any[] = [];
  const needsTransactional: any[] = [];

  for (const p of products) {
    const title = (p.website_meta_title || '').toLowerCase();
    const desc = (p.website_meta_description || '').toLowerCase();
    const kw = (p.website_meta_keywords || '').toLowerCase();
    const combined = title + ' ' + desc + ' ' + kw;

    // Check transactional keywords
    const hasDE = TRANSACTIONAL_KEYWORDS.german.some(k => combined.includes(k));
    const hasIT = TRANSACTIONAL_KEYWORDS.italian.some(k => combined.includes(k));
    const hasEN = TRANSACTIONAL_KEYWORDS.english.some(k => combined.includes(k));
    const hasFR = TRANSACTIONAL_KEYWORDS.french.some(k => combined.includes(k));

    const hasAny = hasDE || hasIT || hasEN || hasFR;

    if (hasAny) hasTransactional++;
    if (hasDE) hasGermanKw++;
    if (hasIT) hasItalianKw++;
    if (hasEN) hasEnglishKw++;

    // Check LAPA branding
    if (combined.includes('lapa')) hasLAPA++;

    // Check Swiss context
    if (combined.includes('schweiz') || combined.includes('svizzera') || combined.includes('switzerland') || combined.includes('suisse')) {
      hasSwissContext++;
    }

    // Score this product
    let score = 0;
    if (hasDE) score += 2; // German is most important for Swiss market
    if (hasEN) score += 1;
    if (hasIT) score += 1;
    if (combined.includes('lapa')) score += 1;
    if (combined.includes('schweiz') || combined.includes('svizzera')) score += 1;

    if (score >= 4) {
      if (perfect.length < 5) {
        perfect.push({ id: p.id, name: p.name, title: p.website_meta_title, score });
      }
    } else if (!hasAny && needsTransactional.length < 15) {
      needsTransactional.push({ id: p.id, name: p.name, title: p.website_meta_title || '(vuoto)' });
    }
  }

  const total = products.length;
  const pctGerman = ((hasGermanKw/total)*100).toFixed(1);
  const pctEnglish = ((hasEnglishKw/total)*100).toFixed(1);
  const pctItalian = ((hasItalianKw/total)*100).toFixed(1);
  const pctTrans = ((hasTransactional/total)*100).toFixed(1);
  const pctNoTrans = (((total-hasTransactional)/total)*100).toFixed(1);
  const pctLAPA = ((hasLAPA/total)*100).toFixed(1);
  const pctSwiss = ((hasSwissContext/total)*100).toFixed(1);

  console.log('='.repeat(70));
  console.log('  ANALISI MODELLO VINCENTE SEO - KEYWORD TRANSAZIONALI');
  console.log('='.repeat(70));
  console.log('');
  console.log('Totale prodotti pubblicati: ' + products.length);
  console.log('');
  console.log('KEYWORD TRANSAZIONALI');
  console.log('-'.repeat(70));
  console.log('DE Tedesco (kaufen, bestellen, online):  ' + hasGermanKw + ' prodotti (' + pctGerman + '%)');
  console.log('EN Inglese (buy, order, online):         ' + hasEnglishKw + ' prodotti (' + pctEnglish + '%)');
  console.log('IT Italiano (comprare, ordina):          ' + hasItalianKw + ' prodotti (' + pctItalian + '%)');
  console.log('-'.repeat(70));
  console.log('Con ALMENO UNA keyword transazionale:    ' + hasTransactional + ' prodotti (' + pctTrans + '%)');
  console.log('SENZA keyword transazionali:             ' + (total - hasTransactional) + ' prodotti (' + pctNoTrans + '%)');
  console.log('');
  console.log('BRANDING & LOCALIZZAZIONE');
  console.log('-'.repeat(70));
  console.log('Con "LAPA" in SEO:                       ' + hasLAPA + ' prodotti (' + pctLAPA + '%)');
  console.log('Con contesto svizzero:                   ' + hasSwissContext + ' prodotti (' + pctSwiss + '%)');
  console.log('');

  if (perfect.length > 0) {
    console.log('ESEMPI PRODOTTI CON MODELLO VINCENTE:');
    console.log('-'.repeat(70));
    for (const p of perfect) {
      console.log('   ID ' + p.id + ': ' + p.name.substring(0, 45));
      console.log('   Title: ' + p.title);
      console.log('   Score: ' + p.score + '/6');
      console.log('');
    }
  }

  if (needsTransactional.length > 0) {
    console.log('PRODOTTI SENZA KEYWORD TRANSAZIONALI (prime 15):');
    console.log('-'.repeat(70));
    for (const p of needsTransactional) {
      console.log('   ID ' + p.id + ': ' + p.name.substring(0, 50));
      console.log('   Title: ' + (p.title || '').substring(0, 60));
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('  CONCLUSIONE');
  console.log('='.repeat(70));

  const percentTrans = (hasTransactional/total)*100;
  if (percentTrans >= 90) {
    console.log('ECCELLENTE! Il modello vincente e applicato alla maggior parte dei prodotti.');
  } else if (percentTrans >= 70) {
    console.log('BUONO! Ma ci sono ancora prodotti da ottimizzare.');
  } else {
    console.log('ATTENZIONE! Molti prodotti mancano di keyword transazionali.');
  }

  console.log('');
  console.log(hasTransactional + '/' + total + ' prodotti hanno keyword transazionali (' + pctTrans + '%)');
  console.log('Gap da colmare: ' + (total - hasTransactional) + ' prodotti');
  console.log('');
}

main();
