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

// Scrittura CON context lang
async function writeWithLang(id, values, lang) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'write',
        args: [[id], values],
        kwargs: { context: { lang: lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json());
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

  console.log('\n=== TEST ORDINE TRADUZIONI (ARTICOLO 75) ===\n');

  // Provo nell'ordine: DE, FR, EN, poi IT per ultimo
  console.log('1. TEDESCO (de_CH)...');
  await writeWithLang(75, {
    name: "TEST DE - Titel",
    subtitle: "TEST DE - Untertitel",
    content: "<h2>CONTENUTO TEDESCO TEST</h2><p>Questo dovrebbe essere tedesco.</p>"
  }, 'de_CH');

  console.log('2. FRANCESE (fr_CH)...');
  await writeWithLang(75, {
    name: "TEST FR - Titre",
    subtitle: "TEST FR - Sous-titre",
    content: "<h2>CONTENUTO FRANCESE TEST</h2><p>Ceci devrait être en français.</p>"
  }, 'fr_CH');

  console.log('3. INGLESE (en_US)...');
  await writeWithLang(75, {
    name: "TEST EN - Title",
    subtitle: "TEST EN - Subtitle",
    content: "<h2>ENGLISH CONTENT TEST</h2><p>This should be English.</p>"
  }, 'en_US');

  console.log('4. ITALIANO (it_IT) - ULTIMO...');
  await writeWithLang(75, {
    name: "TEST IT - Titolo",
    subtitle: "TEST IT - Sottotitolo",
    content: "<h2>CONTENUTO ITALIANO TEST</h2><p>Questo dovrebbe essere italiano.</p>"
  }, 'it_IT');

  // Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await readWithLang(75, lang);
    const contentPreview = (data?.content || '').replace(/<[^>]*>/g, '').substring(0, 50);
    console.log(`[${lang}]`);
    console.log(`  Titolo: ${data?.name}`);
    console.log(`  Contenuto: ${contentPreview}...`);
    console.log('');
  }
}

main();
