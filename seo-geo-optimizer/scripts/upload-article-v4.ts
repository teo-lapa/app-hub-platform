/**
 * Upload articolo SEO+GEO su Odoo con traduzioni corrette
 * Versione 4: Matching per posizione nell'HTML originale
 *
 * Il problema: Odoo segmenta il testo dividendo su tag <strong>, <em>, ecc.
 * Soluzione: Per ogni segmento IT, trova dove appare nell'HTML e poi trova
 * il segmento corrispondente nell'HTML target alla stessa posizione.
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
 * Trova la traduzione di un segmento confrontando le posizioni nell'HTML
 */
function findTranslation(segment: string, itHtml: string, targetHtml: string): string | null {
  // Cerca la prima occorrenza del segmento nell'HTML italiano
  const itPos = itHtml.indexOf(segment);
  if (itPos === -1) return null;

  // Conta quanti caratteri (esclusi tag) ci sono prima di questa posizione
  const textBefore = itHtml.substring(0, itPos).replace(/<[^>]+>/g, '');
  const textBeforeLen = textBefore.length;

  // Trova la stessa posizione nell'HTML target
  // Scanerizzo l'HTML target contando i caratteri di testo
  let targetTextCount = 0;
  let inTag = false;
  let targetStartPos = -1;

  for (let i = 0; i < targetHtml.length; i++) {
    if (targetHtml[i] === '<') {
      inTag = true;
    } else if (targetHtml[i] === '>') {
      inTag = false;
    } else if (!inTag) {
      if (targetTextCount === textBeforeLen) {
        targetStartPos = i;
        break;
      }
      targetTextCount++;
    }
  }

  if (targetStartPos === -1) return null;

  // Ora trova la fine del segmento target
  // La lunghezza del segmento in caratteri dovrebbe essere simile
  const segmentTextLen = segment.replace(/<[^>]+>/g, '').length;

  let targetEndCount = 0;
  let targetEndPos = targetStartPos;
  inTag = false;

  for (let i = targetStartPos; i < targetHtml.length && targetEndCount < segmentTextLen; i++) {
    if (targetHtml[i] === '<') {
      inTag = true;
    } else if (targetHtml[i] === '>') {
      inTag = false;
    } else if (!inTag) {
      targetEndCount++;
    }
    targetEndPos = i + 1;
  }

  // Estrai il segmento target
  let targetSegment = targetHtml.substring(targetStartPos, targetEndPos);

  // SEMPRE rimuovi i tag HTML dalla traduzione
  // Odoo vuole solo testo puro nelle traduzioni
  targetSegment = targetSegment.replace(/<[^>]+>/g, '');

  return targetSegment.trim() || null;
}

async function uploadArticle(articlePath: string) {
  console.log(`📄 Caricamento: ${articlePath}\n`);

  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ Autenticato\n');

  const itData = article.translations.it_IT;

  // 1. Crea articolo in italiano
  console.log('🇮🇹 Creo articolo...');
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

  console.log(`   ID: ${postId}\n`);

  // 2. Traduci campi semplici
  console.log('📝 Traduco campi...');
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
    console.log(`   ✅ ${odooLang}`);
  }

  // 3. Leggi segmenti
  console.log('\n📖 Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  if (!segmentData?.[0]?.length) {
    console.log('   Nessun segmento');
    return postId;
  }

  const sources = [...new Set(segmentData[0].map((s: any) => s.source))] as string[];
  console.log(`   ${sources.length} segmenti`);

  // 4. Traduci ogni lingua
  console.log('\n🌍 Traduco content...');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    const translations: Record<string, string> = {};
    let found = 0;

    for (const src of sources) {
      const trans = findTranslation(src, itData.content_html, langData.content_html);
      if (trans && trans !== src) {
        translations[src] = trans;
        found++;
      }
    }

    console.log(`   ${odooLang}: ${found}/${sources.length}`);

    if (Object.keys(translations).length > 0) {
      try {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId], 'content', { [odooLang]: translations }
        ]);
        console.log(`   ✅ Applicato`);
      } catch (e: any) {
        console.log(`   ❌ ${e.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`\n✅ FATTO! ID: ${postId}`);
  return postId;
}

const articlePath = process.argv[2] || 'data/new-articles/article-09-thurgau.json';
uploadArticle(articlePath).catch(console.error);
