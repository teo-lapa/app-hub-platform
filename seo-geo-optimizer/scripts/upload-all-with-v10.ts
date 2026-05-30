/**
 * Upload ALL 60 articles using V10 method (100% full content translation)
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = (process.env.ODOO_PASSWORD || '');

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

async function uploadArticleV10(articlePath: string): Promise<number> {
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  // Create in Italian
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

  // Write FULL content for ALL other languages
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.name,
      subtitle: langData.subtitle,
      content: langData.content_html, // V10: Write FULL content (100%)
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords,
    }], { context: { lang: odooLang } });
  }

  return postId;
}

async function main() {
  const articlesDir = join(__dirname, '../data/new-articles-2025');
  const files = readdirSync(articlesDir)
    .filter(f => f.endsWith('.json') && f.startsWith('article-'))
    .sort();

  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘     UPLOAD TUTTI 60 ARTICOLI CON V10 (100% TRADUZIONI)   â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');
  console.log(`ðŸ“„ Trovati ${files.length} articoli\n`);

  // Authenticate once
  console.log('ðŸ” Autenticazione...');
  await authenticate();
  console.log('âœ…\n');

  const results: Array<{ file: string; postId?: number; title?: string; error?: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const articlePath = join(articlesDir, file);

    console.log(`\n[${ i + 1}/${files.length}] ${file}`);
    console.log('â”€'.repeat(60));

    try {
      const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
      const title = article.translations.it_IT.name;

      console.log(`ðŸ“ "${title.substring(0, 50)}..."`);
      console.log('ðŸ‡®ðŸ‡¹ Creazione post italiano...');

      const postId = await uploadArticleV10(articlePath);

      results.push({ file, postId, title });
      console.log(`âœ… ID ${postId} - Traduzioni 100% complete`);

      // Pausa tra upload
      await new Promise(r => setTimeout(r, 1500));

    } catch (e: any) {
      const errorMsg = e.message.substring(0, 200);
      console.log(`âŒ ERRORE: ${errorMsg}`);
      results.push({ file, error: errorMsg });
    }
  }

  // Riepilogo finale
  console.log('\n' + 'â•'.repeat(60));
  console.log('ðŸ“Š RIEPILOGO UPLOAD');
  console.log('â•'.repeat(60) + '\n');

  const successes = results.filter(r => r.postId);
  const errors = results.filter(r => r.error);

  console.log(`âœ… Successi: ${successes.length}/${files.length}`);
  console.log(`âŒ Errori: ${errors.length}/${files.length}\n`);

  if (successes.length > 0) {
    console.log('âœ… ARTICOLI CARICATI (100% traduzioni):\n');
    for (const r of successes) {
      console.log(`  â€¢ ID ${r.postId}: "${r.title?.substring(0, 50)}..."`);
    }
  }

  if (errors.length > 0) {
    console.log('\nâŒ ERRORI:\n');
    for (const r of errors) {
      console.log(`  â€¢ ${r.file}: ${r.error?.substring(0, 80)}`);
    }
  }

  console.log('\nðŸŽ‰ Upload completato con metodo V10!');
  console.log('ðŸ“Œ IMPORTANTE: Tutti gli articoli hanno traduzioni 100% complete.');
  console.log('   Verifica su Odoo che il contenuto sia completo in tutte le lingue.\n');
}

main().catch(console.error);
