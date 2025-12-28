/**
 * Check what's actually on Odoo for article translations
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate(): Promise<number> {
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
  if (!data.result?.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
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
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

async function main() {
  console.log('🔐 Autenticazione...\n');
  await authenticate();

  // Check article 1 (Post ID 286)
  const postId = 286;

  console.log(`📋 Controllo articolo ID ${postId} in tutte le lingue:\n`);

  const languages = {
    'it_IT': 'Italiano',
    'de_CH': 'Tedesco',
    'fr_CH': 'Francese',
    'en_US': 'Inglese'
  };

  for (const [lang, langName] of Object.entries(languages)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${langName} (${lang})`);
    console.log('='.repeat(60));

    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'subtitle', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      const p = post[0];
      console.log(`\n📝 Titolo: ${p.name}`);
      console.log(`\n📄 Sottotitolo: ${p.subtitle || 'N/A'}`);
      console.log(`\n📖 Contenuto (primi 500 caratteri):`);
      const content = p.content || '';
      const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(textContent.substring(0, 500) + '...\n');
    }
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
