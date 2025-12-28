/**
 * Inspect translation records for a working article
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

  // Check article 376 which has working translations
  const workingArticleId = 376;

  console.log(`📋 Ispeziono articolo ID ${workingArticleId}...\n`);

  // Get the article
  const post = await callOdoo('blog.post', 'read', [[workingArticleId], ['name', 'content']], {
    context: { lang: 'it_IT' }
  });

  console.log('Articolo (IT):');
  console.log(`   Titolo: ${post[0].name}`);
  console.log(`   Content preview: ${post[0].content.substring(0, 100)}...\n`);

  // Get translation records for this article
  console.log('🔍 Cerco ir.translation records per questo articolo...\n');

  try {
    const translations = await callOdoo('ir.translation', 'search_read', [
      [
        ['res_id', '=', workingArticleId],
        ['name', '=like', 'blog.post,%']
      ],
      ['name', 'lang', 'type', 'src', 'value', 'state']
    ], {});

    console.log(`Trovati ${translations.length} record di traduzione:\n`);

    for (const trans of translations.slice(0, 10)) {
      console.log(`  Field: ${trans.name}`);
      console.log(`  Lang: ${trans.lang}`);
      console.log(`  Type: ${trans.type}`);
      console.log(`  Src: ${trans.src ? trans.src.substring(0, 50) + '...' : 'NULL'}`);
      console.log(`  Value: ${trans.value ? trans.value.substring(0, 50) + '...' : 'NULL'}`);
      console.log(`  State: ${trans.state}`);
      console.log('');
    }
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

main().catch(console.error);
