/**
 * Delete all 60 articles and recreate them with V10 method
 * This ensures proper translations in all languages
 */

import { readFileSync, readdirSync } from 'fs';
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

function titleSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().trim().slice(0, 30);
  const aNorm = normalize(a);
  const bNorm = normalize(b);

  if (aNorm === bNorm) return 100;
  if (bNorm.includes(aNorm) || aNorm.includes(bNorm)) return 80;

  const aWords = aNorm.split(/\s+/);
  const bWords = bNorm.split(/\s+/);
  let matchCount = 0;

  for (const word of aWords) {
    if (bWords.some(w => w.includes(word) || word.includes(w))) {
      matchCount++;
    }
  }

  return Math.floor((matchCount / Math.max(aWords.length, bWords.length)) * 100);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   ELIMINA E RICREA ARTICOLI CON METODO V10 (100%)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Get ALL blog posts from Odoo
  console.log('📋 Recupero tutti i post da Odoo...');
  const allPosts = await callOdoo('blog.post', 'search_read', [
    [['blog_id', '=', 4]],
    ['id', 'name']
  ], { context: { lang: 'it_IT' } });

  console.log(`   Trovati ${allPosts.length} post\n`);

  // Load articles
  const articlesDir = join(__dirname, '../data/new-articles-2025');
  const files = readdirSync(articlesDir)
    .filter(f => f.endsWith('.json') && f.startsWith('article-'))
    .sort();

  console.log(`📄 ${files.length} articoli da processare\n`);

  const results: Array<{ file: string; oldPostId?: number; newPostId?: number; success: boolean; error?: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const articlePath = join(articlesDir, file);

    console.log(`\n[${i + 1}/${files.length}] ${file}`);
    console.log('─'.repeat(60));

    try {
      const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
      const itData = article.translations.it_IT;

      if (!itData) {
        console.log('❌ Manca traduzione italiana');
        results.push({ file, success: false, error: 'No Italian translation' });
        continue;
      }

      const title = itData.name;
      console.log(`📝 "${title.slice(0, 50)}..."`);

      // Find and delete old post
      let bestMatch: any = null;
      let bestScore = 0;

      for (const post of allPosts) {
        const score = titleSimilarity(title, post.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = post;
        }
      }

      let oldPostId: number | undefined;

      if (bestMatch && bestScore >= 50) {
        oldPostId = bestMatch.id;
        console.log(`   🗑️  Elimino vecchio post ID ${oldPostId}...`);
        await callOdoo('blog.post', 'unlink', [[oldPostId]], {});
        await new Promise(r => setTimeout(r, 500));
      }

      // Create new post with V10 method
      console.log('   🆕 Creo nuovo post...');

      // 1. Create in Italian
      const newPostId = await callOdoo('blog.post', 'create', [{
        name: itData.name,
        subtitle: itData.subtitle,
        content: itData.content_html,
        blog_id: 4,
        website_meta_title: itData.meta.title,
        website_meta_description: itData.meta.description,
        website_meta_keywords: itData.meta.keywords,
        is_published: false
      }], { context: { lang: 'it_IT' } });

      console.log(`   ✅ Creato ID ${newPostId}`);

      // 2. Write FULL content for ALL other languages (V10 method)
      for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
        if (jsonLang === 'it_IT') continue;

        const langData = article.translations[jsonLang];
        if (!langData) {
          console.log(`   ⚠️  ${jsonLang}: skip (traduzione mancante)`);
          continue;
        }

        const langFlag = jsonLang === 'de_DE' ? '🇩🇪' : jsonLang === 'fr_FR' ? '🇫🇷' : '🇬🇧';
        console.log(`   ${langFlag} ${odooLang}...`);

        await callOdoo('blog.post', 'write', [[newPostId], {
          name: langData.name,
          subtitle: langData.subtitle,
          content: langData.content_html,  // ← V10: FULL CONTENT 100%
          website_meta_title: langData.meta.title,
          website_meta_description: langData.meta.description,
          website_meta_keywords: langData.meta.keywords
        }], { context: { lang: odooLang } });

        await new Promise(r => setTimeout(r, 200));
      }

      console.log(`✅ Creato con traduzioni 100% complete`);
      results.push({ file, oldPostId, newPostId, success: true });

      await new Promise(r => setTimeout(r, 1500));

    } catch (e: any) {
      const errorMsg = e.message ? e.message.slice(0, 100) : String(e).slice(0, 100);
      console.log(`❌ ERRORE: ${errorMsg}`);
      results.push({ file, success: false, error: errorMsg });
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RIEPILOGO FINALE');
  console.log('═'.repeat(60) + '\n');

  const successes = results.filter(r => r.success);
  const errors = results.filter(r => !r.success);

  console.log(`✅ Successi: ${successes.length}/${files.length}`);
  console.log(`❌ Errori: ${errors.length}/${files.length}\n`);

  if (successes.length > 0) {
    const newIds = successes.filter(r => r.newPostId).map(r => r.newPostId);
    console.log(`📝 Nuovi post creati: IDs ${Math.min(...newIds as number[])} - ${Math.max(...newIds as number[])}\n`);
  }

  if (errors.length > 0 && errors.length <= 10) {
    console.log('❌ ERRORI:\n');
    for (const r of errors) {
      console.log(`  • ${r.file}: ${r.error}`);
    }
    console.log('');
  }

  console.log('🎉 Processo completato!');
  console.log('📋 IMPORTANTE: Verifica le traduzioni su Odoo prima di pubblicare.\n');
}

main().catch(console.error);
