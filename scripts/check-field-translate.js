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

async function getFieldsInfo() {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/fields_get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'fields_get',
        args: [['name', 'subtitle', 'content']],
        kwargs: { attributes: ['string', 'type', 'translate'] }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result;
}

async function main() {
  await auth();

  console.log('\n=== VERIFICA CAMPI TRADUCIBILI blog.post ===\n');

  const fields = await getFieldsInfo();

  for (const [fieldName, fieldInfo] of Object.entries(fields)) {
    console.log(`Campo: ${fieldName}`);
    console.log(`  Tipo: ${fieldInfo.type}`);
    console.log(`  Traducibile: ${fieldInfo.translate ? 'SI' : 'NO'}`);
    console.log('');
  }
}

main();
