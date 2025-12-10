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
  console.log(`Calling ${model}.${method} with kwargs:`, JSON.stringify(kwargs));
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

  console.log('\n=== TEST: with_context diretto ===\n');

  // Provo usando with_context nel metodo
  // In Odoo, write con context dovrebbe funzionare

  // Prima leggo per vedere cosa c'è
  console.log('Leggo stato attuale...');
  for (const lang of ['it_IT', 'de_CH']) {
    const data = await callOdoo('blog.post', 'read',
      [[postId], ['content']],
      { context: { lang } }
    );
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 40);
    console.log(`[${lang}] ${contentText}...`);
  }

  // Provo a scrivere solo tedesco con context
  console.log('\nScrivo SOLO tedesco con context de_CH...');
  const result = await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>NUR DEUTSCH</h2><p>Nur deutscher Text hier.</p>' }],
    { context: { lang: 'de_CH' } }
  );
  console.log('Risultato write:', result);

  // Verifica
  console.log('\nVerifica dopo write tedesco...');
  for (const lang of ['it_IT', 'de_CH']) {
    const data = await callOdoo('blog.post', 'read',
      [[postId], ['content']],
      { context: { lang } }
    );
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 40);
    console.log(`[${lang}] ${contentText}...`);
  }
}

main();
