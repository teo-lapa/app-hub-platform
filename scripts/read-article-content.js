const ODOO = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  user: 'paul@lapa.ch',
  pass: 'lapa201180'
};

let sid = '';

async function auth() {
  const r = await fetch(ODOO.url + '/web/session/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { db: ODOO.db, login: ODOO.user, password: ODOO.pass }, id: 1 })
  });
  const cookie = r.headers.get('set-cookie');
  if (cookie) {
    const match = cookie.match(/session_id=([^;]+)/);
    if (match) sid = match[1];
  }
}

async function callOdoo(model, method, args, kwargs = {}) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'session_id=' + sid,
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs: kwargs || {} },
      id: Math.floor(Math.random() * 1000000000)
    })
  });
  const data = await r.json();
  if (data.error) {
    console.error('ERRORE:', data.error.data?.message || data.error.message);
    return null;
  }
  return data.result;
}

// Articolo da leggere - passato come argomento
const POST_ID = parseInt(process.argv[2]) || 2;

async function main() {
  await auth();

  console.log(`\n=== ARTICOLO ${POST_ID} ===\n`);

  // Leggo contenuto italiano
  const data = await callOdoo('blog.post', 'read',
    [[POST_ID], ['name', 'subtitle', 'content']],
    { context: { lang: 'it_IT' } }
  );

  if (!data || !data[0]) {
    console.log('Articolo non trovato');
    return;
  }

  const article = data[0];
  console.log('TITOLO:', article.name);
  console.log('SOTTOTITOLO:', article.subtitle || '(nessuno)');
  console.log('\nCONTENUTO:');
  console.log(article.content);

  // Leggo i segmenti da tradurre
  console.log('\n=== SEGMENTI DA TRADURRE ===\n');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);

  if (segmentData && segmentData[0]) {
    const segments = segmentData[0];
    const sourceTexts = [...new Set(segments.map(s => s.source))];
    console.log(`Trovati ${sourceTexts.length} segmenti:\n`);
    sourceTexts.forEach((s, i) => {
      console.log(`${i+1}. "${s}"`);
    });
  }
}

main();
