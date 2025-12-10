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

async function readWithLang(id, lang) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'read',
        args: [[id]],
        kwargs: { fields: ['name', 'subtitle', 'content'], context: { lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result?.[0];
}

async function main() {
  await auth();

  console.log('=== VERIFICA ARTICOLO 75 IN TUTTE LE LINGUE ===\n');

  const langs = [
    { code: 'it_IT', name: 'ITALIANO' },
    { code: 'de_CH', name: 'TEDESCO' },
    { code: 'fr_CH', name: 'FRANCESE' },
    { code: 'en_US', name: 'INGLESE' }
  ];

  for (const lang of langs) {
    const data = await readWithLang(75, lang.code);
    console.log(`[${lang.name}]`);
    console.log(`  Titolo: ${data?.name}`);
    console.log(`  Sottotitolo: ${data?.subtitle?.substring(0, 60)}...`);
    const content = (data?.content || '').replace(/<[^>]*>/g, '').substring(0, 80);
    console.log(`  Contenuto: ${content}...`);
    console.log('');
  }

  console.log('=== VERIFICA ARTICOLO 89 IN TUTTE LE LINGUE ===\n');

  for (const lang of langs) {
    const data = await readWithLang(89, lang.code);
    console.log(`[${lang.name}]`);
    console.log(`  Titolo: ${data?.name}`);
    console.log(`  Sottotitolo: ${data?.subtitle?.substring(0, 60)}...`);
    console.log('');
  }
}

main();
