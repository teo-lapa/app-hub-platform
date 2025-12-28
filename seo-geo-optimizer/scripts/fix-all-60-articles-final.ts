/**
 * FIX TUTTI I 60 ARTICOLI CON TRADUZIONI AL 100%
 * Applica il metodo funzionante a tutti gli articoli IDs 347-406
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
 * Extract all elements of a specific type with their text content
 */
function extractElements(html: string, tagName: string): Array<{ text: string }> {
  const elements: Array<{ text: string }> = [];
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match;

  while ((match = regex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    elements.push({ text });
  }

  return elements;
}

/**
 * STRUCTURAL MATCHING: Find translation by matching HTML element structure
 * This works better for complex HTML with lists, tables, etc.
 */
function findBestTranslation(
  segment: string,
  itHtml: string,
  langHtml: string
): string | null {
  const cleanSegment = segment.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Try matching in different element types
  const elementTypes = ['li', 'p', 'h1', 'h2', 'h3', 'h4', 'td', 'th', 'div'];

  for (const tagName of elementTypes) {
    const itElements = extractElements(itHtml, tagName);
    const langElements = extractElements(langHtml, tagName);

    // If we have the same number of elements, try index matching
    if (itElements.length === langElements.length && itElements.length > 0) {
      for (let i = 0; i < itElements.length; i++) {
        const itText = itElements[i].text;

        // Check if this element contains our segment
        if (itText.includes(cleanSegment) || cleanSegment.includes(itText)) {
          return langElements[i].text;
        }

        // Try fuzzy match
        const words = cleanSegment.split(/\s+/);
        const itWords = itText.split(/\s+/);
        const matchingWords = words.filter(w => itWords.includes(w));

        if (matchingWords.length > words.length * 0.6 && words.length > 2) {
          return langElements[i].text;
        }
      }
    }
  }

  return null;
}

async function fixArticleTranslations(postId: number, article: any): Promise<void> {
  const itData = article.translations.it_IT;

  // 1. Update meta fields translations
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
  }

  // 2. Wait for Odoo
  await new Promise(r => setTimeout(r, 1000));

  // 3. Get field translation segments
  const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});

  if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
    const segments = fieldTrans[0];
    const sourceTexts: string[] = [...new Set(segments.map((s: any) => s.source))];

    // 4. Translate content using structural matching
    for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
      if (jsonLang === 'it_IT') continue;
      const langData = article.translations[jsonLang as keyof typeof article.translations];
      if (!langData) continue;

      const translations: Record<string, string> = {};

      for (const srcText of sourceTexts) {
        // Use structural matching with full HTML
        const translation = findBestTranslation(srcText, itData.content_html, langData.content_html);
        if (translation && translation.length > 3) {
          translations[srcText] = translation;
        }
      }

      if (Object.keys(translations).length > 0) {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId],
          'content',
          { [odooLang]: translations }
        ], {});
      }
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        FIX TUTTI I 60 ARTICOLI - TRADUZIONI AL 100%        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Get all article files
  const articlesDir = join(__dirname, '../data/new-articles-2025');
  const files = readdirSync(articlesDir)
    .filter(f => f.startsWith('article-') && f.endsWith('.json'))
    .sort();

  console.log(`📚 Trovati ${files.length} articoli\n`);
  console.log('🔧 Inizio fix traduzioni...\n');

  const results: any[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const articleNum = i + 1;
    const postId = 347 + i; // IDs 347-406

    try {
      const articlePath = join(articlesDir, file);
      const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
      const itData = article.translations.it_IT;

      console.log(`[${articleNum}/60] ID ${postId}: ${itData.name.substring(0, 50)}...`);

      await fixArticleTranslations(postId, article);

      successCount++;
      results.push({ id: postId, status: 'success', title: itData.name });
      console.log(`         ✅ Completato\n`);

      // Piccola pausa tra articoli per non sovraccaricare
      await new Promise(r => setTimeout(r, 500));

    } catch (e: any) {
      errorCount++;
      results.push({ id: postId, status: 'error', error: e.message });
      console.log(`         ❌ Errore: ${e.message}\n`);
    }
  }

  console.log('='.repeat(70));
  console.log('📊 RIEPILOGO FINALE');
  console.log('='.repeat(70));
  console.log(`✅ Successi: ${successCount}/60`);
  console.log(`❌ Errori: ${errorCount}/60`);
  console.log('');

  if (errorCount > 0) {
    console.log('Articoli con errori:');
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`   ID ${r.id}: ${r.error}`);
    });
  }

  console.log('\n🎉 FIX COMPLETATO!\n');
}

main().catch(console.error);
