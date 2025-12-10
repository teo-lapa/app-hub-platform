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
      params: { model, method, args, kwargs: kwargs || {} },
      id: Math.floor(Math.random() * 1000000000)
    })
  });
  return (await r.json()).result;
}

async function main() {
  await auth();

  // Leggo tutti gli articoli con info SEO
  const posts = await callOdoo('blog.post', 'search_read',
    [[]],
    { fields: ['id', 'name', 'is_seo_optimized', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'], order: 'id asc' }
  );

  console.log('=== ARTICOLI NON OTTIMIZZATI SEO ===\n');
  let notOptimized = [];
  for (const post of posts) {
    if (post.is_seo_optimized === false) {
      notOptimized.push(post);
      console.log('ID ' + post.id + ': ' + post.name.substring(0, 60));
      console.log('   Meta Title: ' + (post.website_meta_title || 'MANCANTE'));
      console.log('   Meta Desc: ' + (post.website_meta_description ? post.website_meta_description.substring(0, 50) + '...' : 'MANCANTE'));
      console.log('   Keywords: ' + (post.website_meta_keywords || 'MANCANTI'));
      console.log('');
    }
  }

  console.log('\n=== ARTICOLI GIA OTTIMIZZATI SEO ===\n');
  for (const post of posts) {
    if (post.is_seo_optimized === true) {
      console.log('ID ' + post.id + ': ' + post.name.substring(0, 60) + ' ✓');
    }
  }

  console.log('\n\nTotale articoli da ottimizzare: ' + notOptimized.length);
  console.log('Totale articoli gia ottimizzati: ' + (posts.length - notOptimized.length));
}

main();
