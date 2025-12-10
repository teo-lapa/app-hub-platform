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
          order: 'id desc',
          limit: 50
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

  // Cerco articoli più vecchi che potrebbero essere stati creati dall'app
  console.log('\n=== CERCO ARTICOLI CREATI DALL\'APP ===\n');

  const articles = await searchArticles();

  // Mostro gli articoli per trovarne uno creato dall'app
  console.log('Articoli disponibili:');
  for (const a of articles.slice(0, 30)) {
    console.log(`ID ${a.id}: ${a.name} (${a.create_date})`);
  }

  // Controllo articoli specifici - provo con ID più bassi che potrebbero essere dell'app
  const testIds = [64, 65, 69, 73];

  console.log('\n=== CONTROLLO CONTENUTI PER LINGUA ===\n');

  for (const id of testIds) {
    console.log(`\n--- ARTICOLO ${id} ---`);

    const contents = {};
    for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
      const data = await readWithLang(id, lang);
      if (data) {
        const contentText = (data.content || '').replace(/<[^>]*>/g, '').substring(0, 100);
        contents[lang] = contentText;
        console.log(`[${lang}] Titolo: ${data.name?.substring(0, 50)}`);
        console.log(`         Contenuto: ${contentText}...`);
      }
    }

    // Verifico se i contenuti sono diversi
    const uniqueContents = new Set(Object.values(contents));
    console.log(`\n>>> Contenuti DIVERSI per lingua: ${uniqueContents.size > 1 ? 'SI' : 'NO'}`);
  }
}

main();
