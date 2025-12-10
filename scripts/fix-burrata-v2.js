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
        kwargs: { fields: ['name', 'subtitle'], context: { lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result?.[0];
}

async function main() {
  await auth();

  console.log('\n=== BURRATA - TUTTE LE LINGUE CON CONTEXT ===\n');

  // Scrivo italiano con context it_IT
  console.log('1. Italiano (it_IT)...');
  await writeWithLang(74, {
    name: "La Burrata: Un Cuore Cremoso dalla Tradizione Pugliese",
    subtitle: "Scopri la storia autentica di questo gioiello caseario, dalle sue origini ingegnose alla tavola moderna"
  }, 'it_IT');

  console.log('2. Tedesco (de_CH)...');
  await writeWithLang(74, {
    name: "Die Burrata: Ein cremiges Herz aus apulischer Tradition",
    subtitle: "Entdecken Sie die authentische Geschichte dieses Molkereijuwels"
  }, 'de_CH');

  console.log('3. Francese (fr_CH)...');
  await writeWithLang(74, {
    name: "La Burrata : Un cœur crémeux de la tradition des Pouilles",
    subtitle: "Découvrez l'histoire authentique de ce joyau laitier"
  }, 'fr_CH');

  console.log('4. Inglese (en_US)...');
  await writeWithLang(74, {
    name: "Burrata: A Creamy Heart from Apulian Tradition",
    subtitle: "Discover the authentic history of this dairy jewel"
  }, 'en_US');

  // Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await readWithLang(74, lang);
    console.log(`[${lang}] ${data?.name}`);
  }
}

main();
