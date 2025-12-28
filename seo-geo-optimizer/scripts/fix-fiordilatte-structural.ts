/**
 * Fix Fiordilatte - Structural HTML matching
 * Match segments by finding corresponding HTML elements
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
 * Extract all elements of a specific type with their text content
 */
function extractElements(html: string, tagName: string): Array<{ text: string; fullText: string }> {
  const elements: Array<{ text: string; fullText: string }> = [];
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match;

  while ((match = regex.exec(html)) !== null) {
    const fullText = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    elements.push({ text: fullText, fullText });
  }

  return elements;
}

/**
 * Find translation by matching segment to HTML element
 */
function findTranslation(segment: string, itHtml: string, langHtml: string): string | null {
  const cleanSegment = segment.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Try matching in different element types
  const elementTypes = ['li', 'p', 'h1', 'h2', 'h3', 'h4', 'td', 'th'];

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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FIX FIORDILATTE - STRUCTURAL MATCHING                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...\n');
  await authenticate();

  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log('🗑️  Eliminazione articolo ID 420 esistente...');
  try {
    await callOdoo('blog.post', 'unlink', [[420]], {});
    console.log('   ✅ Eliminato\n');
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}\n`);
  }

  await new Promise(r => setTimeout(r, 1000));

  console.log('📝 Creazione articolo con Italiano...');
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

  // Update meta fields
  console.log('🌍 Aggiornamento meta fields:\n');
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

  // Get segments
  console.log('\n📋 Recupero segmenti da Odoo...');
  const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});

  if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
    const segments = fieldTrans[0];
    const sourceTexts: string[] = [...new Set(segments.map((s: any) => s.source))];
    console.log(`   ${sourceTexts.length} segmenti\n`);

    console.log('🌐 Traduzioni content (structural matching):\n');

    for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
      if (jsonLang === 'it_IT') continue;
      const langData = article.translations[jsonLang as keyof typeof article.translations];
      if (!langData) continue;

      const translations: Record<string, string> = {};

      for (const srcText of sourceTexts) {
        const translation = findTranslation(srcText, itData.content_html, langData.content_html);
        if (translation && translation.length > 3) {
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
  console.log(`🔗 Articolo ID: ${postId}\n`);
}

main().catch(console.error);
