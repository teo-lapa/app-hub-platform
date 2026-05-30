/**
 * Fix Fiordilatte using update_field_translations with full HTML
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = (process.env.ODOO_PASSWORD || '');

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
  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘     FIX FIORDILATTE - UPDATE_FIELD_TRANSLATIONS            â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

  console.log('ðŸ” Autenticazione...\n');
  await authenticate();

  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log('ðŸ—‘ï¸  Eliminazione articolo ID 420 esistente...');
  try {
    await callOdoo('blog.post', 'unlink', [[420]], {});
    console.log('   âœ… Eliminato\n');
  } catch (e: any) {
    console.log(`   âš ï¸  ${e.message}\n`);
  }

  await new Promise(r => setTimeout(r, 1000));

  console.log('ðŸ“ Creazione articolo SOLO con Italiano...');
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

  console.log(`   âœ… Creato ID ${postId}\n`);

  await new Promise(r => setTimeout(r, 2000));

  // First, update meta fields for other languages
  console.log('ðŸŒ Aggiornamento meta fields (name, subtitle, ecc.):\n');
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang as keyof typeof article.translations];
    if (!langData) continue;

    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.name,
      subtitle: langData.subtitle,
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords
    }], { context: { lang: odooLang } });

    console.log(`   âœ… ${odooLang} meta fields`);
    await new Promise(r => setTimeout(r, 500));
  }

  await new Promise(r => setTimeout(r, 2000));

  // Now try to use update_field_translations with the FULL HTML
  console.log('\nðŸ“‹ Tentativo update_field_translations con HTML completo:\n');

  const translations: Record<string, Record<string, string>> = {};

  // For each language, map the Italian HTML to the translated HTML
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang as keyof typeof article.translations];
    if (!langData) continue;

    // Map the FULL Italian HTML to the FULL translated HTML
    translations[odooLang] = {
      [itData.content_html]: langData.content_html
    };
  }

  try {
    for (const [odooLang, trans] of Object.entries(translations)) {
      console.log(`   ${odooLang}: Tentativo update...`);
      await callOdoo('blog.post', 'update_field_translations', [
        [postId],
        'content',
        { [odooLang]: trans }
      ], {});
      console.log(`   âœ… ${odooLang}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e: any) {
    console.log(`\n   âš ï¸  ERRORE: ${e.message}\n`);
    console.log('   Questo metodo non funziona con HTML completo.\n');
  }

  console.log('\nâœ… COMPLETATO!\n');
  console.log(`ðŸ”— Articolo ID: ${postId}\n`);
}

main().catch(console.error);
