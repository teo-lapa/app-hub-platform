/**
 * Debug: mostra i segmenti di Odoo per capire perché l'H1 non viene tradotto
 */

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
  const data = await response.json();
  return data.result.uid;
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
  const postId = 175;

  console.log(`📖 SEGMENTI ARTICOLO ${postId}\n`);

  await authenticate();

  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  const sources = [...new Set(segmentData[0].map(s => s.source))];

  console.log(`Totale segmenti: ${sources.length}\n`);
  console.log('Primi 30 segmenti:\n');

  for (let i = 0; i < Math.min(30, sources.length); i++) {
    const seg = sources[i];
    const preview = seg.length > 80 ? seg.substring(0, 77) + '...' : seg;
    console.log(`[${i+1}] ${preview}`);
  }

  // Cerca segmenti che contengono "Burrata di Andria"
  console.log('\n🔍 Segmenti che contengono "Burrata di Andria DOP":\n');
  const h1Segments = sources.filter(s => s.includes('Burrata di Andria DOP'));
  h1Segments.forEach((seg, i) => {
    console.log(`[${i+1}] ${seg}`);
  });
}

main().catch(console.error);
