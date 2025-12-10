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
  const italianContent = '<h2>Contenuto Italiano Vero</h2><p>Questo testo deve rimanere italiano.</p>';

  console.log('\n=== TEST: ir.translation ===\n');

  // 1. Scrivo contenuto italiano
  console.log('1. Scrivo contenuto ITALIANO...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: italianContent }]
  );

  // 2. Cerco traduzioni esistenti per questo campo
  console.log('2. Cerco traduzioni esistenti...');
  const existingTranslations = await callOdoo('ir.translation', 'search_read',
    [],
    {
      domain: [
        ['type', '=', 'model'],
        ['name', '=', 'blog.post,content'],
        ['res_id', '=', postId]
      ],
      fields: ['id', 'lang', 'src', 'value', 'state']
    }
  );
  console.log('Traduzioni trovate:', existingTranslations?.length || 0);
  if (existingTranslations) {
    for (const t of existingTranslations) {
      console.log(`  [${t.lang}] ID ${t.id}: ${t.value?.substring(0, 30)}...`);
    }
  }

  // 3. Creo/Aggiorno traduzioni via ir.translation
  console.log('\n3. Creo traduzione TEDESCO via ir.translation...');

  // Prima cerco se esiste già
  const existingDE = await callOdoo('ir.translation', 'search',
    [[
      ['type', '=', 'model'],
      ['name', '=', 'blog.post,content'],
      ['res_id', '=', postId],
      ['lang', '=', 'de_CH']
    ]]
  );

  const deContent = '<h2>Deutscher Inhalt NEU</h2><p>Dies ist der neue deutsche Text.</p>';

  if (existingDE && existingDE.length > 0) {
    console.log('   Traduzione esistente, aggiorno...');
    await callOdoo('ir.translation', 'write',
      [existingDE, { value: deContent }]
    );
  } else {
    console.log('   Nessuna traduzione esistente, creo nuova...');
    await callOdoo('ir.translation', 'create',
      [{
        type: 'model',
        name: 'blog.post,content',
        res_id: postId,
        lang: 'de_CH',
        src: italianContent,
        value: deContent,
        state: 'translated'
      }]
    );
  }

  // Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH']) {
    const data = await callOdoo('blog.post', 'read',
      [[postId], ['content']],
      { context: { lang } }
    );
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 50);
    console.log(`[${lang}] ${contentText}...`);
  }
}

main();
