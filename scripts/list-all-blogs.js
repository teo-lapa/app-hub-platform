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

async function searchRead() {
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
          fields: ['id', 'name'],
          order: 'id',
          limit: 100
        }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result;
}

async function main() {
  await auth();
  const articles = await searchRead();
  console.log('TUTTI GLI ARTICOLI DEL BLOG:\n');
  for (const a of articles) {
    console.log('ID ' + a.id + ': ' + a.name);
  }
}

main();
