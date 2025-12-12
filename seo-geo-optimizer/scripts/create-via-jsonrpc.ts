/**
 * Crea articolo usando JSON-RPC come fa l'interfaccia web di Odoo
 */

import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

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

async function call(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
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
  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ Autenticato\n');

  // Elimina articolo 117
  console.log('🗑️ Elimino articolo 117...');
  try { await call('blog.post', 'unlink', [[117]]); } catch (e) {}

  // Crea articolo in italiano
  console.log('🇮🇹 Creo articolo in italiano...');
  const itData = article.translations.it_IT;

  const postId = await call('blog.post', 'create', [{
    name: itData.name,
    subtitle: itData.subtitle,
    content: itData.content_html,
    blog_id: 4,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    is_published: false
  }], { context: { lang: 'it_IT' } });

  console.log(`   ID: ${postId}`);

  // Leggi translations con get_field_translations
  console.log('\n📖 Leggo blocchi per content...');
  const fieldTrans = await call('blog.post', 'get_field_translations', [[postId], 'content'], {});
  console.log(`   ${fieldTrans[0].length} blocchi`);

  // Provo a usare il metodo che usa l'interfaccia web
  // Quando clicchi "Traduci" su un campo, Odoo chiama web_save con context
  console.log('\n📝 Provo web_save per traduzione DE...');
  const deData = article.translations.de_DE;

  try {
    const result = await call('blog.post', 'web_save', [[postId], {
      name: deData.name,
      subtitle: deData.subtitle,
      content: deData.content_html,
      website_meta_title: deData.meta.title,
      website_meta_description: deData.meta.description,
      website_meta_keywords: deData.meta.keywords,
    }], { context: { lang: 'de_CH' } });
    console.log('   Risultato web_save:', result ? 'OK' : 'false');
  } catch (e: any) {
    console.log('   Errore:', e.message.substring(0, 200));
  }

  // Verifica
  console.log('\n🔍 Verifica traduzioni...');
  for (const lang of ['it_IT', 'de_CH']) {
    const data = await call('blog.post', 'read', [[postId]], {
      fields: ['name', 'content'],
      context: { lang }
    });
    const h1 = data[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] || 'N/A';
    console.log(`   ${lang}: name="${data[0]?.name?.substring(0, 40)}" H1="${h1.substring(0, 40)}"`);
  }

  console.log(`\n📌 Articolo: ${postId}`);
}

main().catch(console.error);
