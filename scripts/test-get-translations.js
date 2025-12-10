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

  console.log('\n=== TEST: get_field_translations (Odoo 17+) ===\n');

  // Provo get_field_translations
  console.log('Provo get_field_translations...');
  const translations = await callOdoo('blog.post', 'get_field_translations',
    [[postId], 'content']
  );
  console.log('Risultato:', JSON.stringify(translations, null, 2));

  // Provo anche con name che sicuramente funziona
  console.log('\nProvo get_field_translations su name...');
  const nameTranslations = await callOdoo('blog.post', 'get_field_translations',
    [[postId], 'name']
  );
  console.log('Risultato name:', JSON.stringify(nameTranslations, null, 2));
}

main();
