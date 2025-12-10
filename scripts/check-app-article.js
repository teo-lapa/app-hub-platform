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

async function searchArticles() {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/search_read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'search_read',
        args: [],
        kwargs: {
          domain: [],
          fields: ['id', 'name', 'create_date'],
          order: 'create_date desc',
          limit: 20
        }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result;
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
        kwargs: { fields: ['name', 'content'], context: { lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result?.[0];
}

async function main() {
  await auth();

  console.log('\n=== ULTIMI ARTICOLI DEL BLOG ===\n');
  const articles = await searchArticles();

  for (const a of articles) {
    console.log(`ID ${a.id}: ${a.name} (${a.create_date})`);
  }

  // Controllo articolo 90 o più recente che potrebbe essere stato creato dall'app
  console.log('\n=== VERIFICO SE CONTENUTI TRADOTTI ESISTONO ===\n');

  // Provo articolo 91 o 90 se esistono
  const testIds = [91, 90, 89, 74];

  for (const testId of testIds) {
    console.log(`\n--- Articolo ${testId} ---`);
    for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
      const data = await readWithLang(testId, lang);
      if (data) {
        const contentStart = (data.content || '').replace(/<[^>]*>/g, '').substring(0, 40);
        console.log(`[${lang}] Titolo: ${data.name?.substring(0, 40)}... | Contenuto: ${contentStart}...`);
      }
    }
  }
}

main();
