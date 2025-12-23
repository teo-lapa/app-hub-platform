/**
 * Analizza quali segmenti NON vengono tradotti e perché
 */

const fs = require('fs');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate() {
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
  return (await response.json()).result.uid;
}

async function callOdoo(model, method, args, kwargs = {}) {
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
  return data.result;
}

async function main() {
  const postId = 207; // Articolo v8-perfect fresh run

  console.log('🔍 ANALISI SEGMENTI NON TRADOTTI\n');
  console.log(`Articolo ID: ${postId}\n`);

  await authenticate();

  // Leggi i segmenti
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  if (!segmentData?.[0]) {
    console.log('❌ Nessun segmento trovato');
    return;
  }

  // Analizza per lingua DE
  console.log('═'.repeat(70));
  console.log('LINGUA: TEDESCO (de_CH)');
  console.log('═'.repeat(70) + '\n');

  const segments = segmentData[0];
  const sources = [...new Set(segments.map(s => s.source))];

  console.log(`Totale segmenti unici: ${sources.length}\n`);

  // Conta traduzioni per DE
  const deTranslations = segments.filter(s => s.lang === 'de_CH' && s.value && s.value.trim() !== s.source.trim());
  const deTranslatedSources = new Set(deTranslations.map(s => s.source));

  console.log(`Segmenti tradotti in DE: ${deTranslatedSources.size}/${sources.length}\n`);

  // Trova segmenti NON tradotti
  const untranslated = sources.filter(src => !deTranslatedSources.has(src));

  console.log(`\n📋 SEGMENTI NON TRADOTTI (${untranslated.length}):\n`);

  // Categorizza i segmenti non tradotti
  const categories = {
    heading: [],
    paragraph: [],
    list: [],
    table: [],
    other: []
  };

  for (const seg of untranslated.slice(0, 30)) { // Prime 30
    if (seg.match(/^<h[1-6]/)) {
      categories.heading.push(seg);
    } else if (seg.includes('</strong>') || seg.includes('</em>') || seg.includes('</a>')) {
      categories.paragraph.push(seg);
    } else if (seg.match(/^(✅|❌|🍷|👉|•|-|\d+\.)/)) {
      categories.list.push(seg);
    } else if (seg.includes('|')) {
      categories.table.push(seg);
    } else {
      categories.other.push(seg);
    }
  }

  console.log(`\n🔹 HEADING NON TRADOTTI (${categories.heading.length}):`);
  categories.heading.forEach((s, i) => {
    console.log(`  [${i+1}] ${s.substring(0, 80)}${s.length > 80 ? '...' : ''}`);
  });

  console.log(`\n🔹 PARAGRAFI CON TAG HTML NON TRADOTTI (${categories.paragraph.length}):`);
  categories.paragraph.slice(0, 5).forEach((s, i) => {
    console.log(`  [${i+1}] ${s.substring(0, 80)}${s.length > 80 ? '...' : ''}`);
  });

  console.log(`\n🔹 LISTE NON TRADOTTE (${categories.list.length}):`);
  categories.list.slice(0, 5).forEach((s, i) => {
    console.log(`  [${i+1}] ${s.substring(0, 80)}${s.length > 80 ? '...' : ''}`);
  });

  console.log(`\n🔹 ALTRI NON TRADOTTI (${categories.other.length}):`);
  categories.other.slice(0, 10).forEach((s, i) => {
    console.log(`  [${i+1}] ${s.substring(0, 80)}${s.length > 80 ? '...' : ''}`);
  });

  // Verifica se i segmenti esistono nell'HTML source
  console.log('\n' + '═'.repeat(70));
  console.log('ANALISI PRESENZA NELL\'HTML SOURCE');
  console.log('═'.repeat(70) + '\n');

  const article = JSON.parse(fs.readFileSync('data/new-articles/article-02-burrata-andria-dop.json', 'utf-8'));
  const deHtml = article.translations.de_DE.content_html;

  console.log('Verifico se i primi 10 segmenti non tradotti esistono nell\'HTML tedesco...\n');

  untranslated.slice(0, 10).forEach((seg, i) => {
    const found = deHtml.includes(seg);
    console.log(`[${i+1}] ${found ? '✅ TROVATO' : '❌ NON TROVATO'}: "${seg.substring(0, 60)}..."`);
  });

  console.log('\n' + '═'.repeat(70));
}

main().catch(console.error);
