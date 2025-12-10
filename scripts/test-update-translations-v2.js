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

  console.log('\n=== TEST: update_field_translations CORRETTO ===\n');

  // Prima scrivo il contenuto italiano base
  console.log('1. Scrivo contenuto ITALIANO base...');
  await callOdoo('blog.post', 'write',
    [[postId], { content: '<h2>Contenuto Italiano Base</h2><p>Questo è il testo italiano di base.</p>' }]
  );

  // Poi uso update_field_translations per le traduzioni
  // Sintassi: record.update_field_translations(field_name, translations_dict)
  console.log('2. Aggiungo traduzioni con update_field_translations...');

  // Devo chiamare sul record specifico
  const result = await callOdoo('blog.post', 'update_field_translations',
    [
      [postId],  // ids
      'content',  // field_name
      {
        'de_CH': '<h2>Deutscher Inhalt</h2><p>Dies ist der deutsche Text.</p>',
        'fr_CH': '<h2>Contenu Français</h2><p>Ceci est le texte français.</p>',
        'en_US': '<h2>English Content</h2><p>This is the English text.</p>'
      }
    ]
  );

  console.log('Risultato:', result);

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
