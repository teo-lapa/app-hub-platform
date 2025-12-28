/**
 * Test simple write approach - create empty, then write each language
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

const LANG_MAP: Record<string, string> = {
  'it_IT': 'it_IT',
  'de_DE': 'de_CH',
  'fr_FR': 'fr_CH',
  'en_US': 'en_US'
};

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

  // Delete post 410 if exists
  try {
    await callOdoo('blog.post', 'unlink', [[410]], {});
    console.log('🗑️  Eliminato post 410\n');
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.log('⚠️  Post 410 non trovato\n');
  }

  // 1. Create post with minimal data
  console.log('📝 Creazione post vuoto...\n');
  const postId = await callOdoo('blog.post', 'create', [{
    blog_id: 4,
    is_published: false
  }], {});
  console.log(`✅ Creato post ID ${postId}\n`);

  // 2. Write ALL languages one by one using write with context
  console.log('🌍 Scrittura traduzioni...\n');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    const langData = article.translations[jsonLang as keyof typeof article.translations];
    if (!langData) continue;

    console.log(`   Scrittura ${odooLang}...`);

    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.name,
      subtitle: langData.subtitle,
      content: langData.content_html,
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords
    }], { context: { lang: odooLang } });

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n⏳ Attendo 3 secondi...\n');
  await new Promise(r => setTimeout(r, 3000));

  // 3. Verify
  console.log('📋 VERIFICA TRADUZIONI:\n');

  const languages = {
    'it_IT': 'Italiano 🇮🇹',
    'de_CH': 'Tedesco 🇩🇪',
    'fr_CH': 'Francese 🇫🇷',
    'en_US': 'Inglese 🇬🇧'
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
