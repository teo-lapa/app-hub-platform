/**
 * Fix Fiordilatte article with improved list extraction
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

/**
 * IMPROVED: Extract all text from HTML including list items
 * This version properly handles nested tags and list items
 */
function extractAllTexts(html: string): string[] {
  const texts: string[] = [];

  // Remove scripts and styles
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove all HTML tags but keep the text
  // This regex removes tags while preserving text content
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Split by multiple spaces/newlines and clean up
  const lines = cleaned.split(/\s{2,}|\n+/);

  for (const line of lines) {
    const trimmed = line.trim().replace(/\s+/g, ' ');
    if (trimmed && trimmed.length > 0 && !/^[\s\n\r]*$/.test(trimmed)) {
      texts.push(trimmed);
    }
  }

  return texts;
}

/**
 * IMPROVED: Find best translation with better matching
 */
function findBestTranslation(
  sourceText: string,
  itTexts: string[],
  langTexts: string[]
): string | null {
  const normalized = sourceText.replace(/\s+/g, ' ').trim();

  // 1. Exact match
  const exactIdx = itTexts.findIndex(t => t === normalized);
  if (exactIdx >= 0 && langTexts[exactIdx]) {
    return langTexts[exactIdx];
  }

  // 2. Substring match (both ways)
  for (let i = 0; i < itTexts.length; i++) {
    const itText = itTexts[i];
    if (itText.includes(normalized) || normalized.includes(itText)) {
      if (langTexts[i]) return langTexts[i];
    }
  }

  // 3. Word-by-word fuzzy match
  const sourceWords = normalized.toLowerCase().split(/\s+/);
  if (sourceWords.length >= 3) {
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i < itTexts.length; i++) {
      const itWords = itTexts[i].toLowerCase().split(/\s+/);
      const matchingWords = sourceWords.filter(w => itWords.includes(w));
      const score = matchingWords.length / sourceWords.length;

      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestMatch = i;
      }
    }

    if (bestMatch >= 0 && langTexts[bestMatch]) {
      return langTexts[bestMatch];
    }
  }

  return null;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       FIX FIORDILATTE - VERSIONE MIGLIORATA               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...\n');
  await authenticate();

  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log('📋 TEST ESTRAZIONE TESTI MIGLIORATA:\n');
  const itTexts = extractAllTexts(itData.content_html);
  console.log(`   Italiano: ${itTexts.length} testi estratti`);
  console.log(`   Primi 10 testi estratti:\n`);
  itTexts.slice(0, 10).forEach((t, i) => {
    console.log(`      ${i + 1}. ${t.substring(0, 80)}...`);
  });

  const deData = article.translations.de_DE;
  const deTexts = extractAllTexts(deData.content_html);
  console.log(`\n   Tedesco: ${deTexts.length} testi estratti`);
  console.log(`   Primi 10 testi estratti:\n`);
  deTexts.slice(0, 10).forEach((t, i) => {
    console.log(`      ${i + 1}. ${t.substring(0, 80)}...`);
  });

  console.log('\n🗑️  Eliminazione articolo ID 418 esistente...');
  try {
    await callOdoo('blog.post', 'unlink', [[418]], {});
    console.log('   ✅ Eliminato\n');
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}\n`);
  }

  await new Promise(r => setTimeout(r, 1000));

  console.log('📝 Creazione nuovo articolo...');
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

  // Meta fields
  console.log('🌍 Aggiornamento meta fields...');
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

    console.log(`   ✅ ${odooLang}`);
  }

  await new Promise(r => setTimeout(r, 2000));

  // Content translations
  console.log('\n📋 Recupero segmenti da Odoo...');
  const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});

  if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
    const segments = fieldTrans[0];
    const sourceTexts: string[] = [...new Set(segments.map((s: any) => s.source))];
    console.log(`   ${sourceTexts.length} segmenti da tradurre\n`);

    console.log('🌐 Traduzioni content (con estrazione migliorata):\n');
    for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
      if (jsonLang === 'it_IT') continue;
      const langData = article.translations[jsonLang as keyof typeof article.translations];
      if (!langData) continue;

      const langTexts = extractAllTexts(langData.content_html);
      const translations: Record<string, string> = {};

      for (const srcText of sourceTexts) {
        const translation = findBestTranslation(srcText, itTexts, langTexts);
        if (translation) {
          translations[srcText] = translation;
        }
      }

      const matchPercent = Math.round((Object.keys(translations).length / sourceTexts.length) * 100);
      console.log(`   ${odooLang}: ${Object.keys(translations).length}/${sourceTexts.length} (${matchPercent}%)`);

      if (Object.keys(translations).length > 0) {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId],
          'content',
          { [odooLang]: translations }
        ], {});
      }
    }
  }

  console.log('\n✅ COMPLETATO!\n');
  console.log(`🔗 Nuovo articolo ID: ${postId}\n`);
}

main().catch(console.error);
