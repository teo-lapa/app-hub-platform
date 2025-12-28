/**
 * Delete and recreate problematic articles with correct content
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

// From the structural matching script
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

function findBestTranslation(
  segment: string,
  itHtml: string,
  langHtml: string
): string | null {
  const cleanSegment = segment.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const elementTypes = ['li', 'p', 'h1', 'h2', 'h3', 'h4', 'td', 'th', 'div'];

  for (const tagName of elementTypes) {
    const itElements = extractElements(itHtml, tagName);
    const langElements = extractElements(langHtml, tagName);

    if (itElements.length === langElements.length && itElements.length > 0) {
      for (let i = 0; i < itElements.length; i++) {
        const itText = itElements[i].text;

        if (itText.includes(cleanSegment) || cleanSegment.includes(itText)) {
          return langElements[i].text;
        }

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

async function recreateArticle(oldPostId: number, articlePath: string) {
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log(`\n🗑️  Eliminazione ID ${oldPostId}...`);
  try {
    await callOdoo('blog.post', 'unlink', [[oldPostId]], {});
    console.log(`   ✅ Eliminato`);
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}`);
  }

  await new Promise(r => setTimeout(r, 1000));

  console.log(`📝 Creazione nuovo articolo...`);
  const newPostId = await callOdoo('blog.post', 'create', [{
    name: itData.name,
    blog_id: 4,
    subtitle: itData.subtitle,
    content: itData.content_html,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    tag_ids: [[6, 0, itData.tag_ids || []]]
  }], { context: { lang: 'it_IT' } });

  console.log(`   ✅ Nuovo ID: ${newPostId}`);

  await new Promise(r => setTimeout(r, 2000));

  // Meta fields
  console.log(`🌍 Meta fields...`);
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang as keyof typeof article.translations];
    if (!langData) continue;

    await callOdoo('blog.post', 'write', [[newPostId], {
      name: langData.name,
      subtitle: langData.subtitle,
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords
    }], { context: { lang: odooLang } });
  }

  await new Promise(r => setTimeout(r, 2000));

  // Content translations
  console.log(`📋 Content translations...`);
  const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[newPostId], 'content'], {});

  if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
    const segments = fieldTrans[0];
    const sourceTexts: string[] = [...new Set(segments.map((s: any) => s.source))];

    for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
      if (jsonLang === 'it_IT') continue;
      const langData = article.translations[jsonLang as keyof typeof article.translations];
      if (!langData) continue;

      const translations: Record<string, string> = {};

      for (const srcText of sourceTexts) {
        const translation = findBestTranslation(srcText, itData.content_html, langData.content_html);
        if (translation && translation.length > 3) {
          translations[srcText] = translation;
        }
      }

      if (Object.keys(translations).length > 0) {
        await callOdoo('blog.post', 'update_field_translations', [
          [newPostId],
          'content',
          { [odooLang]: translations }
        ], {});
      }

      const percent = Math.round((Object.keys(translations).length / sourceTexts.length) * 100);
      console.log(`   ${odooLang}: ${percent}%`);
    }
  }

  return newPostId;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         RICREA ARTICOLI PROBLEMATICI                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...\n');
  await authenticate();

  // Problematic articles that need recreation
  const problematicArticles = [
    { id: 355, file: 'article-09-speck-alto-adige-igp.json' },
    { id: 360, file: 'article-14-cacio-e-pepe-perfetta.json' },
    { id: 365, file: 'article-19-burrata-conservazione-servizio.json' },
    { id: 390, file: 'article-44-gestione-inventario-ridurre-sprechi.json' },
    { id: 400, file: 'article-54-menu-vegetariano-vegano.json' }
  ];

  const articlesDir = join(__dirname, '../data/new-articles-2025');
  const newIds: Record<number, number> = {};

  for (const article of problematicArticles) {
    console.log('='.repeat(70));
    console.log(`\nARTICOLO: ${article.file}`);

    const articlePath = join(articlesDir, article.file);
    const newId = await recreateArticle(article.id, articlePath);
    newIds[article.id] = newId;

    console.log(`✅ Completato - Vecchio ID: ${article.id}, Nuovo ID: ${newId}\n`);

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('='.repeat(70));
  console.log('\n📊 RIEPILOGO RICREAZIONE:');
  console.log('');
  for (const [oldId, newId] of Object.entries(newIds)) {
    console.log(`   ID ${oldId} → ID ${newId}`);
  }
  console.log('');
  console.log('🎉 RICREAZIONE COMPLETATA!\n');
}

main().catch(console.error);
