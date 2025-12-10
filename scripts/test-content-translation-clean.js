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

// ESATTAMENTE come fa callOdoo nell'app
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

  // Uso articolo 75 per il test
  const postId = 75;

  console.log('\n=== TEST TRADUZIONE CONTENUTO ===\n');

  // Step 1: Scrivo contenuto ITALIANO
  console.log('1. Scrivo contenuto ITALIANO...');
  const itContent = '<h2>Contenuto Test Italiano</h2><p>Questo è il contenuto in italiano per il test.</p>';

  const itResult = await callOdoo('blog.post', 'write', [
    [postId],
    { content: itContent }
  ]);
  console.log('   IT:', itResult === true ? 'OK' : 'ERRORE');

  // Step 2: Scrivo traduzione TEDESCO con context
  console.log('2. Scrivo contenuto TEDESCO con context...');
  const deContent = '<h2>Deutscher Testinhalt</h2><p>Dies ist der deutsche Inhalt für den Test.</p>';

  const deResult = await callOdoo('blog.post', 'write',
    [
      [postId],
      { content: deContent }
    ],
    { context: { lang: 'de_CH' } }
  );
  console.log('   DE:', deResult === true ? 'OK' : 'ERRORE');

  // Step 3: Scrivo traduzione FRANCESE con context
  console.log('3. Scrivo contenuto FRANCESE con context...');
  const frContent = '<h2>Contenu de test français</h2><p>Ceci est le contenu français pour le test.</p>';

  const frResult = await callOdoo('blog.post', 'write',
    [
      [postId],
      { content: frContent }
    ],
    { context: { lang: 'fr_CH' } }
  );
  console.log('   FR:', frResult === true ? 'OK' : 'ERRORE');

  // Step 4: Scrivo traduzione INGLESE con context
  console.log('4. Scrivo contenuto INGLESE con context...');
  const enContent = '<h2>English Test Content</h2><p>This is the English content for the test.</p>';

  const enResult = await callOdoo('blog.post', 'write',
    [
      [postId],
      { content: enContent }
    ],
    { context: { lang: 'en_US' } }
  );
  console.log('   EN:', enResult === true ? 'OK' : 'ERRORE');

  // Verifica
  console.log('\n--- VERIFICA LETTURA ---\n');

  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[postId], ['content']],
      { context: { lang } }
    );
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 60);
    console.log(`[${lang}] ${contentText}...`);
  }
}

main();
