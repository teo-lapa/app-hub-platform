/**
 * Debug what's actually stored in article 76
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data = await response.json();
  return data.result.uid;
}

async function searchRead(model: string, domain: any[], fields: string[]): Promise<any[]> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [domain],
        kwargs: { fields, limit: 1 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  await authenticate();

  console.log('🔍 Checking article 76 without any language context:\n');

  const results = await searchRead('blog.post', [['id', '=', 76]], [
    'id',
    'name',
    'subtitle',
    'content',
    'website_meta_title'
  ]);

  if (results.length > 0) {
    const article = results[0];
    console.log('ID:', article.id);
    console.log('Title:', article.name);
    console.log('Subtitle:', article.subtitle);
    console.log('Meta Title:', article.website_meta_title);
    console.log('\nContent preview (first 500 chars):');
    console.log(article.content?.substring(0, 500) || 'NO CONTENT');
  }

  console.log('\n\n🔍 Now checking with it_IT context:\n');

  const response2 = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/blog.post/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'search_read',
        args: [[['id', '=', 76]]],
        kwargs: {
          fields: ['id', 'name', 'subtitle', 'content'],
          limit: 1,
          context: { lang: 'it_IT' }
        }
      },
      id: Date.now()
    })
  });

  const data2 = await response2.json();
  if (data2.result && data2.result.length > 0) {
    const article = data2.result[0];
    console.log('ID:', article.id);
    console.log('Title:', article.name);
    console.log('Subtitle:', article.subtitle);
    console.log('\nContent preview (first 500 chars):');
    console.log(article.content?.substring(0, 500) || 'NO CONTENT');
  }
}

main().catch(console.error);
