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

async function writeBase(id, values) {
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
        kwargs: {}
      },
      id: Date.now()
    })
  });
  return (await r.json());
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

  console.log('\n=== SISTEMAZIONE COMPLETA BURRATA (ID 74) ===\n');

  // STEP 1: Scrivo BASE (italiano) - SENZA context
  console.log('1. Scrivo italiano (base)...');
  await writeBase(74, {
    name: "La Burrata: Un Cuore Cremoso dalla Tradizione Pugliese",
    subtitle: "Scopri la storia autentica di questo gioiello caseario, dalle sue origini ingegnose alla tavola moderna"
  });

  // STEP 2: Traduzioni con context
  console.log('2. Scrivo tedesco...');
  await writeWithLang(74, {
    name: "Die Burrata: Ein cremiges Herz aus apulischer Tradition",
    subtitle: "Entdecken Sie die authentische Geschichte dieses Molkereijuwels, von seinen genialen Ursprüngen bis zum modernen Tisch"
  }, 'de_CH');

  console.log('3. Scrivo francese...');
  await writeWithLang(74, {
    name: "La Burrata : Un cœur crémeux de la tradition des Pouilles",
    subtitle: "Découvrez l'histoire authentique de ce joyau laitier, de ses origines ingénieuses à la table moderne"
  }, 'fr_CH');

  console.log('4. Scrivo inglese...');
  await writeWithLang(74, {
    name: "Burrata: A Creamy Heart from Apulian Tradition",
    subtitle: "Discover the authentic history of this dairy jewel, from its ingenious origins to the modern table"
  }, 'en_US');

  // Verifica finale
  console.log('\n--- VERIFICA FINALE ---\n');
  const langs = [
    { code: 'it_IT', name: 'ITALIANO' },
    { code: 'de_CH', name: 'TEDESCO' },
    { code: 'fr_CH', name: 'FRANCESE' },
    { code: 'en_US', name: 'INGLESE' }
  ];

  for (const lang of langs) {
    const data = await readWithLang(74, lang.code);
    console.log(`[${lang.name}] ${data?.name}`);
  }

  console.log('\nFatto!');
}

main();
