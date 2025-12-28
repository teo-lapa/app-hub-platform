/**
 * Manual test - create article 1 with detailed logging
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

const LANG_MAP: Record<string, string> = {
  'it_IT': 'it_IT',
  'de_DE': 'de_CH',
  'fr_FR': 'fr_CH',
  'en_US': 'en_US'
};

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

  console.log('📄 Caricato JSON articolo\n');

  // Delete old post 347 if exists
  console.log('🗑️  Elimino post 347 se esiste...');
  try {
    await callOdoo('blog.post', 'unlink', [[347]], {});
    console.log('✅ Eliminato\n');
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.log('⚠️  Post 347 non trovato o già eliminato\n');
  }

  // Create in ENGLISH first (not Italian!)
  const enData = article.translations.en_US;
  console.log('🇬🇧 Creazione in INGLESE (base)...');
  console.log(`   Titolo: ${enData.name}`);
  console.log(`   Content (primi 150 char): ${enData.content_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 150)}...\n`);

  const newPostId = await callOdoo('blog.post', 'create', [{
    name: enData.name,
    subtitle: enData.subtitle,
    content: enData.content_html,
    blog_id: 4,
    website_meta_title: enData.meta.title,
    website_meta_description: enData.meta.description,
    website_meta_keywords: enData.meta.keywords,
    is_published: false
  }], { context: { lang: 'en_US' } });

  console.log(`✅ Creato ID ${newPostId}\n`);

  await new Promise(r => setTimeout(r, 1000));

  // Write German
  const deData = article.translations.de_DE;
  console.log('🇩🇪 Scrittura TEDESCO...');
  console.log(`   Titolo: ${deData.name}`);
  console.log(`   Content (primi 150 char): ${deData.content_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 150)}...\n`);

  await callOdoo('blog.post', 'write', [[newPostId], {
    name: deData.name,
    subtitle: deData.subtitle,
    content: deData.content_html,
    website_meta_title: deData.meta.title,
    website_meta_description: deData.meta.description,
    website_meta_keywords: deData.meta.keywords
  }], { context: { lang: 'de_CH' } });

  console.log('✅ Scritto\n');

  await new Promise(r => setTimeout(r, 1000));

  // Write French
  const frData = article.translations.fr_FR;
  console.log('🇫🇷 Scrittura FRANCESE...');
  console.log(`   Titolo: ${frData.name}`);
  console.log(`   Content (primi 150 char): ${frData.content_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 150)}...\n`);

  await callOdoo('blog.post', 'write', [[newPostId], {
    name: frData.name,
    subtitle: frData.subtitle,
    content: frData.content_html,
    website_meta_title: frData.meta.title,
    website_meta_description: frData.meta.description,
    website_meta_keywords: frData.meta.keywords
  }], { context: { lang: 'fr_CH' } });

  console.log('✅ Scritto\n');

  await new Promise(r => setTimeout(r, 1000));

  // Write Italian LAST
  const itData = article.translations.it_IT;
  console.log('🇮🇹 Scrittura ITALIANO (per ultimo)...');
  console.log(`   Titolo: ${itData.name}`);
  console.log(`   Content (primi 150 char): ${itData.content_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 150)}...\n`);

  await callOdoo('blog.post', 'write', [[newPostId], {
    name: itData.name,
    subtitle: itData.subtitle,
    content: itData.content_html,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords
  }], { context: { lang: 'it_IT' } });

  console.log('✅ Scritto\n');

  await new Promise(r => setTimeout(r, 2000));

  // Verify ALL languages
  const langs = {
    'it_IT': 'Italiano 🇮🇹',
    'de_CH': 'Tedesco 🇩🇪',
    'fr_CH': 'Francese 🇫🇷',
    'en_US': 'Inglese 🇬🇧'
  };

  console.log('\n📋 VERIFICA FINALE DI TUTTE LE LINGUE:\n');

  for (const [lang, langName] of Object.entries(langs)) {
    const post = await callOdoo('blog.post', 'read', [[newPostId], ['name', 'content']], {
      context: { lang }
    });
    const content = post[0].content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`${langName}:`);
    console.log(`   Titolo: ${post[0].name}`);
    console.log(`   Content: ${content.substring(0, 120)}...\n`);
  }

  console.log('🎉 Test completato!');
}

main().catch(console.error);
