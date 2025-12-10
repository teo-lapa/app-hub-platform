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
  console.log('Auth:', sid ? 'OK' : 'FAILED');
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
      params: {
        model,
        method,
        args,
        kwargs: kwargs || {}
      },
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

async function main() {
  await auth();

  const postId = 75;

  console.log('\n=== TEST: TRADUZIONE PER SEGMENTI ===\n');

  // 1. Leggo le traduzioni attuali per vedere i segmenti
  console.log('1. Leggo segmenti...');
  const translations = await callOdoo('blog.post', 'get_field_translations',
    [[postId], 'content']
  );

  const segments = translations[0];
  console.log(`   Trovati ${segments.length} segmenti`);

  // Raggruppo per source (il testo originale italiano)
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Testi unici da tradurre: ${sourceTexts.length}`);
  for (const src of sourceTexts) {
    console.log(`   - "${src.substring(0, 40)}..."`);
  }

  // 2. Preparo le traduzioni per ogni segmento
  // Il formato per update_field_translations è:
  // { lang: { source_text: translated_text } }
  console.log('\n2. Preparo traduzioni per de_CH...');

  const deTranslations = {};
  for (const src of sourceTexts) {
    if (src === 'Contenuto Italiano Vero') {
      deTranslations[src] = 'Deutscher Inhalt Wahr';
    } else if (src === 'Questo testo deve rimanere italiano.') {
      deTranslations[src] = 'Dieser Text muss auf Deutsch sein.';
    }
  }

  console.log('   Traduzioni preparate:', deTranslations);

  // 3. Aggiorno le traduzioni
  console.log('\n3. Chiamo update_field_translations...');
  const result = await callOdoo('blog.post', 'update_field_translations',
    [[postId], 'content', { de_CH: deTranslations }]
  );
  console.log('   Risultato:', result);

  // 4. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH']) {
    const data = await callOdoo('blog.post', 'read',
      [[postId], ['content']],
      { context: { lang } }
    );
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 60);
    console.log(`[${lang}] ${contentText}...`);
  }
}

main();
