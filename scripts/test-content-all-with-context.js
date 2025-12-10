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
    console.error('ERRORE:', data.error);
    return null;
  }
  return data.result;
}

async function main() {
  await auth();

  const postId = 75;

  console.log('\n=== TEST: TUTTE LE LINGUE CON CONTEXT (INCLUSO IT_IT) ===\n');

  // Scrivo TUTTE le lingue con context, incluso italiano
  console.log('1. ITALIANO (it_IT) con context...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>Contenuto Italiano</h2><p>Questo è il testo italiano FINALE.</p>' }],
    { context: { lang: 'it_IT' } }
  );

  console.log('2. TEDESCO (de_CH) con context...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>Deutscher Inhalt</h2><p>Das ist der deutsche Text FINAL.</p>' }],
    { context: { lang: 'de_CH' } }
  );

  console.log('3. FRANCESE (fr_CH) con context...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>Contenu Français</h2><p>Ceci est le texte français FINAL.</p>' }],
    { context: { lang: 'fr_CH' } }
  );

  console.log('4. INGLESE (en_US) con context...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>English Content</h2><p>This is the English text FINAL.</p>' }],
    { context: { lang: 'en_US' } }
  );

  // Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[postId], ['content']],
      { context: { lang } }
    );
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 50);
    console.log(`[${lang}] ${contentText}...`);
  }
}

main();
