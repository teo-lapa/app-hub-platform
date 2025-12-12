/**
 * Upload articolo SEO+GEO su Odoo con traduzioni corrette
 * Versione 2: Mapping basato su contenuto esatto, non posizione
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
 * Estrae coppie ordinate di testi da HTML
 * Mantiene l'ordine esatto in cui appaiono nel documento
 */
function extractOrderedTexts(html: string): string[] {
  const texts: string[] = [];

  // Regex per trovare tutto il testo tra tag HTML
  // Cattura testo dentro tag comuni
  const tagRegex = /<(h[1-6]|p|li|strong|a|span)[^>]*>([^<]*)<\/\1>/gi;

  // Prima estrai testi da tag specifici nell'ordine in cui appaiono
  let match;
  const seen = new Set<string>();

  // Metodo più semplice: estrai tutto il testo visibile nell'ordine
  const simpleRegex = />([^<]+)</g;
  while ((match = simpleRegex.exec(html)) !== null) {
    const text = match[1].trim();
    // Ignora testi troppo corti o solo whitespace
    if (text && text.length > 1 && !/^\s*$/.test(text) && !seen.has(text)) {
      texts.push(text);
      seen.add(text);
    }
  }

  return texts;
}

/**
 * Crea un dizionario di mapping IT -> altra lingua
 * basato sulla posizione nel documento HTML
 */
function createTranslationMap(itHtml: string, targetHtml: string): Map<string, string> {
  const itTexts = extractOrderedTexts(itHtml);
  const targetTexts = extractOrderedTexts(targetHtml);

  const map = new Map<string, string>();

  // Mappa per posizione (stesso indice = stessa traduzione)
  const minLen = Math.min(itTexts.length, targetTexts.length);
  for (let i = 0; i < minLen; i++) {
    if (itTexts[i] !== targetTexts[i]) { // Solo se diversi
      map.set(itTexts[i], targetTexts[i]);
    }
  }

  return map;
}

async function uploadArticle(articlePath: string) {
  console.log(`📄 Caricamento articolo: ${articlePath}\n`);

  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));

  console.log('🔐 Autenticazione Odoo...');
  await authenticate();
  console.log('✅ Autenticato\n');

  const itData = article.translations.it_IT;

  // 1. Crea articolo in italiano
  console.log('🇮🇹 Creo articolo in ITALIANO...');

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

  console.log(`   ✅ ID: ${postId}\n`);

  // 2. Traduci campi semplici per ogni lingua
  console.log('📝 Traduco name, subtitle, meta...');

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

  // 3. Leggi i segmenti del content da Odoo
  console.log('\n📖 Leggo segmenti content da Odoo...');

  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  if (!segmentData || !Array.isArray(segmentData) || segmentData.length === 0) {
    console.log('   ⚠️ Nessun segmento trovato');
    return postId;
  }

  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map((s: any) => s.source))] as string[];
  console.log(`   ${sourceTexts.length} segmenti unici da Odoo`);

  // Debug: mostra primi 5 segmenti
  console.log('\n   Primi 5 segmenti Odoo:');
  sourceTexts.slice(0, 5).forEach((s, i) => {
    console.log(`   ${i+1}. "${s.substring(0, 60)}${s.length > 60 ? '...' : ''}"`);
  });

  // 4. Per ogni lingua, crea mapping e applica traduzioni
  console.log('\n🌍 Traduco content...');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    // Crea mappa di traduzione IT -> target
    const translationMap = createTranslationMap(itData.content_html, langData.content_html);

    console.log(`\n   ${odooLang}: ${translationMap.size} mappature create`);

    // Per ogni segmento Odoo, cerca la traduzione
    const segmentTranslations: Record<string, string> = {};
    let matched = 0;
    let unmatched = 0;

    for (const srcText of sourceTexts) {
      // Cerca match esatto
      if (translationMap.has(srcText)) {
        segmentTranslations[srcText] = translationMap.get(srcText)!;
        matched++;
      } else {
        // Prova matching parziale (il segmento potrebbe essere parte di un testo più lungo)
        let found = false;
        for (const [itText, targetText] of translationMap.entries()) {
          if (itText.includes(srcText) || srcText.includes(itText)) {
            // Match parziale - usa proporzione
            if (srcText.length > 10) { // Solo per testi significativi
              segmentTranslations[srcText] = targetText;
              matched++;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          unmatched++;
        }
      }
    }

    console.log(`   Matched: ${matched}, Unmatched: ${unmatched}`);

    // Applica traduzioni
    if (Object.keys(segmentTranslations).length > 0) {
      try {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId], 'content', { [odooLang]: segmentTranslations }
        ]);
        console.log(`   ✅ Traduzioni applicate`);
      } catch (e: any) {
        console.log(`   ❌ Errore: ${e.message.substring(0, 100)}`);
      }
    }
  }

  // 5. Verifica
  console.log('\n🔍 Verifica...');
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    const data = await callOdoo('blog.post', 'read', [[postId]], {
      fields: ['name', 'content'],
      context: { lang: odooLang }
    });

    // Estrai primo paragrafo dal content
    const content = data[0]?.content || '';
    const firstP = content.match(/<p[^>]*>([^<]+)<\/p>/)?.[1] || 'N/A';

    console.log(`   ${odooLang}: "${firstP.substring(0, 60)}..."`);
  }

  console.log(`\n✅ COMPLETATO! ID: ${postId}`);
  return postId;
}

const articlePath = process.argv[2] || 'data/new-articles/article-09-thurgau.json';
uploadArticle(articlePath).catch(console.error);
