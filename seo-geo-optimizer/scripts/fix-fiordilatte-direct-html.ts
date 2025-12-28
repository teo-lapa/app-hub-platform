/**
 * Fix Fiordilatte - DIRECT HTML approach
 * Instead of using segments, write the translated HTML directly to each language
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
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       FIX FIORDILATTE - DIRECT HTML METHOD                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...\n');
  await authenticate();

  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log('🗑️  Eliminazione articolo ID 419 esistente...');
  try {
    await callOdoo('blog.post', 'unlink', [[419]], {});
    console.log('   ✅ Eliminato\n');
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}\n`);
  }

  await new Promise(r => setTimeout(r, 1000));

  console.log('📝 Creazione nuovo articolo con Italiano...');
  const postId = await callOdoo('blog.post', 'create', [{
    name: itData.name,
    blog_id: 4,
    subtitle: itData.subtitle,
    content: itData.content_html,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    tag_ids: [[6, 0, itData.tag_ids || []]]
  }], { context: { lang: 'it_IT' } });

  console.log(`   ✅ Creato ID ${postId}\n`);

  await new Promise(r => setTimeout(r, 2000));

  console.log('🌍 Scrittura DIRETTA HTML per ogni lingua:\n');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;

    const langData = article.translations[jsonLang as keyof typeof article.translations];
    if (!langData) continue;

    console.log(`   ${odooLang}: Scrittura HTML tradotto...`);

    // Write ALL fields including content directly in this language
    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.name,
      subtitle: langData.subtitle,
      content: langData.content_html,  // ← DIRECT HTML!
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords
    }], { context: { lang: odooLang } });

    console.log(`   ✅ ${odooLang} completato`);

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n✅ COMPLETATO!\n');
  console.log(`🔗 Nuovo articolo ID: ${postId}\n`);
  console.log('📋 Verifica manualmente che tutte le lingue abbiano il contenuto corretto.\n');
}

main().catch(console.error);
