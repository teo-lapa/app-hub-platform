/**
 * Fix single article 365
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

function extractAllTexts(html: string): string[] {
  const texts: string[] = [];
  const withoutTags = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  const regex = />([^<]+)</g;
  let match;
  while ((match = regex.exec(withoutTags)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 0 && !/^[\s\n\r]*$/.test(text)) {
      const normalized = text.replace(/\s+/g, ' ').trim();
      if (normalized) {
        texts.push(normalized);
      }
    }
  }
  return texts;
}

function findBestTranslation(sourceText: string, itTexts: string[], langTexts: string[]): string | null {
  const normalized = sourceText.replace(/\s+/g, ' ').trim();
  const exactIdx = itTexts.indexOf(normalized);
  if (exactIdx >= 0 && langTexts[exactIdx]) return langTexts[exactIdx];

  for (let i = 0; i < itTexts.length; i++) {
    if (itTexts[i].includes(normalized) || normalized.includes(itTexts[i])) {
      if (langTexts[i]) return langTexts[i];
    }
  }

  const sourceWords = normalized.split(/\s+/);
  if (sourceWords.length > 3) {
    for (let i = 0; i < itTexts.length; i++) {
      const itWords = itTexts[i].split(/\s+/);
      const matchingWords = sourceWords.filter(w => itWords.includes(w));
      if (matchingWords.length > sourceWords.length * 0.7 && langTexts[i]) {
        return langTexts[i];
      }
    }
  }
  return null;
}

async function main() {
  console.log('🔐 Autenticazione...\n');
  await authenticate();

  const articlePath = join(__dirname, '../data/new-articles-2025/article-19-burrata-conservazione-servizio.json');
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;
  const postId = 365;

  console.log(`📝 Fix articolo ID ${postId}: ${itData.name}\n`);

  // 1. Meta fields
  console.log('🌍 Meta fields...');
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
  console.log('   ✅ Done\n');

  await new Promise(r => setTimeout(r, 2000));

  // 2. Content
  console.log('📋 Get segments...');
  const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});

  if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
    const segments = fieldTrans[0];
    const sourceTexts: string[] = [...new Set(segments.map((s: any) => s.source))];
    console.log(`   ${sourceTexts.length} segmenti\n`);

    const itTexts = extractAllTexts(itData.content_html);
    console.log(`📝 ${itTexts.length} testi estratti\n`);

    console.log('🌐 Traduzioni content...');
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
      console.log(`   ${jsonLang}: ${Object.keys(translations).length}/${sourceTexts.length} (${matchPercent}%)`);

      if (Object.keys(translations).length > 0) {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId],
          'content',
          { [odooLang]: translations }
        ], {});
      }
    }
  }

  console.log('\n✅ Completato!\n');
}

main().catch(console.error);
