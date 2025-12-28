/**
 * Test using ir.translation model directly
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;
  const deData = article.translations.de_DE;

  // Delete post 414 if exists
  try {
    await callOdoo('blog.post', 'unlink', [[414]], {});
    console.log('🗑️  Eliminato post 414\n');
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.log('⚠️  Post 414 non trovato\n');
  }

  // 1. Create post in Italian
  console.log('📝 Creazione post in italiano...\n');
  const postId = await callOdoo('blog.post', 'create', [{
    name: itData.name,
    subtitle: itData.subtitle,
    content: itData.content_html,
    blog_id: 4,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    is_published: false
  }], { context: { lang: 'it_IT' } });
  console.log(`✅ Creato post ID ${postId}\n`);

  // 2. Create translation records via ir.translation
  console.log('🌍 Creazione traduzioni via ir.translation...\n');

  // German translation for name field
  console.log('   Creazione traduzione DE per name...');
  await callOdoo('ir.translation', 'create', [{
    name: 'blog.post,name',
    type: 'model',
    lang: 'de_CH',
    res_id: postId,
    src: itData.name,
    value: deData.name,
    state: 'translated'
  }], {});

  // German translation for content field
  console.log('   Creazione traduzione DE per content...');
  await callOdoo('ir.translation', 'create', [{
    name: 'blog.post,content',
    type: 'model',
    lang: 'de_CH',
    res_id: postId,
    src: itData.content_html,
    value: deData.content_html,
    state: 'translated'
  }], {});

  console.log('\n⏳ Attendo 3 secondi...\n');
  await new Promise(r => setTimeout(r, 3000));

  // 3. Verify
  console.log('📋 VERIFICA:\n');

  const languages = {
    'it_IT': 'Italiano 🇮🇹',
    'de_CH': 'Tedesco 🇩🇪'
  };

  for (const [lang, langName] of Object.entries(languages)) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      const p = post[0];
      const textContent = p.content ? p.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'VUOTO';

      console.log(`${langName}:`);
      console.log(`   Titolo: ${p.name}`);
      console.log(`   Content: ${textContent.substring(0, 100)}...\n`);
    }
  }
}

main().catch(console.error);
