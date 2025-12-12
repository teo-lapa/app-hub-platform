/**
 * Upload TUTTI gli articoli SEO+GEO su Odoo - Versione CORRETTA
 * Rimuove tag <strong> per evitare frammentazione segmenti
 */

import { readFileSync, readdirSync } from 'fs';

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

function cleanInlineTags(html: string): string {
  return html
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<em>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<b>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/<i>/gi, '')
    .replace(/<\/i>/gi, '');
}

function extractTexts(html: string): string[] {
  const texts: string[] = [];
  const regex = />([^<]+)</g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 1) {
      texts.push(text);
    }
  }
  return texts;
}

async function uploadArticle(articlePath: string): Promise<{ id: number; name: string }> {
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;
  const cleanItHtml = cleanInlineTags(itData.content_html);

  // Crea articolo
  const postId = await callOdoo('blog.post', 'create', [{
    name: itData.name,
    subtitle: itData.subtitle,
    content: cleanItHtml,
    blog_id: 4,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    is_published: false
  }], { context: { lang: 'it_IT' } });

  // Traduci campi
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.name,
      subtitle: langData.subtitle,
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords,
    }], { context: { lang: odooLang } });
  }

  // Leggi segmenti
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  if (!segmentData?.[0]?.length) return { id: postId, name: itData.name };

  const sources = [...new Set(segmentData[0].map((s: any) => s.source))] as string[];
  const itTexts = extractTexts(cleanItHtml);

  // Traduci content
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    const cleanTargetHtml = cleanInlineTags(langData.content_html);
    const targetTexts = extractTexts(cleanTargetHtml);

    const textMap = new Map<string, string>();
    const minLen = Math.min(itTexts.length, targetTexts.length);
    for (let i = 0; i < minLen; i++) {
      if (itTexts[i] !== targetTexts[i]) {
        textMap.set(itTexts[i], targetTexts[i]);
      }
    }

    const translations: Record<string, string> = {};
    for (const src of sources) {
      if (textMap.has(src)) {
        translations[src] = textMap.get(src)!;
      }
    }

    if (Object.keys(translations).length > 0) {
      try {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId], 'content', { [odooLang]: translations }
        ]);
      } catch (e) {
        // Ignora errori
      }
    }
  }

  return { id: postId, name: itData.name };
}

async function main() {
  console.log('🚀 Upload articoli SEO+GEO (versione corretta)\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ OK\n');

  const articlesDir = 'data/new-articles';
  const files = readdirSync(articlesDir)
    .filter(f => f.startsWith('article-') && f.endsWith('.json'))
    .sort();

  console.log(`📄 ${files.length} articoli da caricare\n`);

  const results: { file: string; id: number; name: string }[] = [];

  for (const file of files) {
    process.stdout.write(`📤 ${file}... `);
    try {
      const result = await uploadArticle(`${articlesDir}/${file}`);
      results.push({ file, ...result });
      console.log(`✅ ID ${result.id}`);
    } catch (e: any) {
      console.log(`❌ ${e.message.substring(0, 50)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(50));
  console.log('RIEPILOGO\n');

  for (const r of results) {
    console.log(`${r.id}: ${r.name.substring(0, 50)}...`);
  }

  console.log(`\n🎉 Caricati ${results.length}/${files.length} articoli`);
}

main().catch(console.error);
