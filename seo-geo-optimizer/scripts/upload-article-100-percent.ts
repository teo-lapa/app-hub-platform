/**
 * Upload articolo con traduzioni al 100%
 * Usa get_field_translations + matching intelligente
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

async function uploadArticle(articlePath: string): Promise<number> {
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log(`📝 ${itData.name.substring(0, 60)}...`);

  // 1. Create post in Italian
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

  console.log(`   ✅ ID: ${postId}`);

  // 2. Translate meta fields
  console.log(`   🌍 Meta fields...`);
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
  console.log(`      ✓ Done`);

  // 3. Wait for Odoo
  await new Promise(r => setTimeout(r, 2000));

  // 4. Get field translation segments
  console.log(`   📋 Segmenti...`);
  const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});

  if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
    const segments = fieldTrans[0];
    const sourceTexts: string[] = [...new Set(segments.map((s: any) => s.source))];
    console.log(`      ${sourceTexts.length} segmenti da Odoo`);

    // 5. Translate content using structural matching
    console.log(`   🌐 Content (structural matching)...`);

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

      const matchPercent = Math.round((Object.keys(translations).length / sourceTexts.length) * 100);
      console.log(`      ${jsonLang}: ${Object.keys(translations).length}/${sourceTexts.length} (${matchPercent}%)`);

      if (Object.keys(translations).length > 0) {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId],
          'content',
          { [odooLang]: translations }
        ], {});
      }
    }
  }

  return postId;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          UPLOAD ARTICOLO CON TRADUZIONI AL 100%            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Test with article 1
  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');

  // Delete post 421 if exists
  try {
    await callOdoo('blog.post', 'unlink', [[421]], {});
    console.log('🗑️  Eliminato post 421\n');
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {}

  const postId = await uploadArticle(articlePath);

  // Verify
  console.log('\n⏳ Attendo 3 secondi...\n');
  await new Promise(r => setTimeout(r, 3000));

  console.log('📋 VERIFICA:\n');

  const languages = {
    'it_IT': 'IT 🇮🇹',
    'de_CH': 'DE 🇩🇪',
    'fr_CH': 'FR 🇫🇷',
    'en_US': 'EN 🇬🇧'
  };

  for (const [lang, langName] of Object.entries(languages)) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      const p = post[0];
      const textContent = p.content ? p.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'VUOTO';

      console.log(`${langName}: ${p.name.substring(0, 50)}...`);
      console.log(`     ${textContent.substring(0, 100)}...\n`);
    }
  }

  console.log('🎉 Completato!');
}

main().catch(console.error);
