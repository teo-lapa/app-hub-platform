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

  console.log('\n=== TEST ORDINE INVERSO: TRADUZIONI PRIMA, ITALIANO ULTIMO ===\n');

  // PRIMA le traduzioni
  console.log('1. Scrivo TEDESCO...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>Deutscher Inhalt</h2><p>Das ist der deutsche Text.</p>' }],
    { context: { lang: 'de_CH' } }
  );

  console.log('2. Scrivo FRANCESE...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>Contenu Français</h2><p>Ceci est le texte français.</p>' }],
    { context: { lang: 'fr_CH' } }
  );

  console.log('3. Scrivo INGLESE...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>English Content</h2><p>This is the English text.</p>' }],
    { context: { lang: 'en_US' } }
  );

  // ULTIMO l'italiano (base)
  console.log('4. Scrivo ITALIANO (ULTIMO - BASE)...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>Contenuto Italiano</h2><p>Questo è il testo italiano.</p>' }]
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
