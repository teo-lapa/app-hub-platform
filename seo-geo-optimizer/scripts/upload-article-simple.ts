/**
 * Upload articolo SEO+GEO su Odoo - Versione SEMPLICE
 *
 * Rimuove i tag <strong> dall'HTML per evitare frammentazione dei segmenti.
 * Poi fa matching per posizione dei testi.
 */

import { readFileSync } from 'fs';

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

/**
 * Rimuove i tag inline (strong, em, b, i) mantenendo il contenuto
 * Questo evita che Odoo frammenti i segmenti
 */
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

/**
 * Estrae testi ordinati dall'HTML
 */
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

async function uploadArticle(articlePath: string) {
  console.log(`📄 ${articlePath}\n`);

  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));

  console.log('🔐 Auth...');
  await authenticate();

  const itData = article.translations.it_IT;

  // Pulisci HTML rimuovendo tag inline
  const cleanItHtml = cleanInlineTags(itData.content_html);

  // 1. Crea articolo con HTML pulito
  console.log('🇮🇹 Creo articolo...');
  const postId = await callOdoo('blog.post', 'create', [{
    name: itData.name,
    subtitle: itData.subtitle,
    content: cleanItHtml,  // HTML senza <strong>
    blog_id: 4,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    is_published: false
  }], { context: { lang: 'it_IT' } });

  console.log(`   ID: ${postId}`);

  // 2. Traduci campi
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
  console.log('   Campi tradotti');

  // 3. Leggi segmenti
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  if (!segmentData?.[0]?.length) {
    console.log('   No segments');
    return postId;
  }

  const sources = [...new Set(segmentData[0].map((s: any) => s.source))] as string[];
  console.log(`   ${sources.length} segmenti`);

  // Estrai testi da HTML pulito italiano
  const itTexts = extractTexts(cleanItHtml);
  console.log(`   ${itTexts.length} testi IT`);

  // 4. Traduci content per ogni lingua
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    // Pulisci anche l'HTML target
    const cleanTargetHtml = cleanInlineTags(langData.content_html);
    const targetTexts = extractTexts(cleanTargetHtml);

    // Crea mapping IT -> target per posizione
    const textMap = new Map<string, string>();
    const minLen = Math.min(itTexts.length, targetTexts.length);
    for (let i = 0; i < minLen; i++) {
      if (itTexts[i] !== targetTexts[i]) {
        textMap.set(itTexts[i], targetTexts[i]);
      }
    }

    // Mappa segmenti Odoo
    const translations: Record<string, string> = {};
    for (const src of sources) {
      if (textMap.has(src)) {
        translations[src] = textMap.get(src)!;
      }
    }

    console.log(`   ${odooLang}: ${Object.keys(translations).length}/${sources.length}`);

    if (Object.keys(translations).length > 0) {
      try {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId], 'content', { [odooLang]: translations }
        ]);
      } catch (e: any) {
        console.log(`   ❌ ${e.message.substring(0, 60)}`);
      }
    }
  }

  console.log(`\n✅ ID: ${postId}`);
  return postId;
}

const articlePath = process.argv[2] || 'data/new-articles/article-09-thurgau.json';
uploadArticle(articlePath).catch(console.error);
