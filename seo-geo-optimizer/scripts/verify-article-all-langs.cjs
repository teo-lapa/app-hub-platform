/**
 * Verifica articolo in tutte le lingue
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: Date.now()
    })
  });

  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }

  const data = await response.json();
  if (!data.result || !data.result.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model, method, args, kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Date.now()
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  const postId = 172; // ID articolo burrata test

  console.log(`🔍 VERIFICA ARTICOLO ID ${postId} IN TUTTE LE LINGUE\n`);

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ Autenticato\n');

  const langs = ['it_IT', 'de_CH', 'fr_CH', 'en_US'];

  for (const lang of langs) {
    console.log(`\n🌐 Lingua: ${lang}`);
    console.log('─'.repeat(70));

    const data = await callOdoo('blog.post', 'read', [[postId]], {
      fields: ['name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'],
      context: { lang }
    });

    const post = data[0];

    console.log(`📝 Title: ${post.name}`);
    console.log(`📝 Subtitle: ${post.subtitle ? post.subtitle.substring(0, 60) + '...' : 'N/A'}`);
    console.log(`📝 Meta Title: ${post.website_meta_title || 'N/A'}`);
    console.log(`📝 Meta Desc: ${post.website_meta_description ? post.website_meta_description.substring(0, 80) + '...' : 'N/A'}`);
    console.log(`📝 Keywords: ${post.website_meta_keywords || 'N/A'}`);

    // Controlla content
    const contentWords = post.content ? post.content.split(/\s+/).length : 0;
    const hasH1 = post.content ? post.content.includes('<h1>') : false;
    const hasH2 = post.content ? post.content.includes('<h2>') : false;

    console.log(`📊 Content: ${contentWords} parole`);
    console.log(`📊 H1: ${hasH1 ? '✓' : '✗'}`);
    console.log(`📊 H2: ${hasH2 ? '✓' : '✗'}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Verifica completata!');
  console.log('═'.repeat(70));
}

main().catch(console.error);
