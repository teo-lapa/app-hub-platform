/**
 * Debug: analizza come Odoo estrae i segmenti dal content HTML
 */

import { readFileSync } from 'fs';

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
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  // Usa articolo 130 (mio test)
  const postId = 130;

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ Autenticato\n');

  console.log(`📖 Leggo segmenti dell'articolo ${postId}...\n`);

  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  const segments = segmentData[0];

  // Raggruppa per lingua
  const byLang: Record<string, any[]> = {};
  for (const seg of segments) {
    if (!byLang[seg.lang]) byLang[seg.lang] = [];
    byLang[seg.lang].push(seg);
  }

  console.log('Lingue trovate:', Object.keys(byLang));
  console.log('');

  // Mostra i source (testo italiano base)
  const sources = [...new Set(segments.map((s: any) => s.source))];
  console.log(`📝 ${sources.length} segmenti source unici:\n`);

  sources.slice(0, 15).forEach((src, i) => {
    console.log(`${i+1}. "${src.substring(0, 80)}${src.length > 80 ? '...' : ''}"`);

    // Mostra come è tradotto in tedesco
    const deSeg = segments.find((s: any) => s.source === src && s.lang === 'de_CH');
    if (deSeg && deSeg.value) {
      console.log(`   DE: "${deSeg.value.substring(0, 80)}${deSeg.value.length > 80 ? '...' : ''}"`);
    }
    console.log('');
  });

  // Analizza struttura segmenti
  console.log('\n📊 Analisi struttura:');

  let containsHtml = 0;
  let plainText = 0;
  let shortSegments = 0;

  for (const src of sources) {
    if (/<[^>]+>/.test(src)) containsHtml++;
    else plainText++;
    if (src.length < 20) shortSegments++;
  }

  console.log(`- Segmenti con HTML interno: ${containsHtml}`);
  console.log(`- Segmenti solo testo: ${plainText}`);
  console.log(`- Segmenti corti (<20 char): ${shortSegments}`);
}

main().catch(console.error);
