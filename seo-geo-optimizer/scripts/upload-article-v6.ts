/**
 * Upload articolo SEO+GEO su Odoo con traduzioni corrette
 * Versione 6: Cerca segmenti esatti nell'HTML (inclusi tag inline)
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
 * Trova il contenuto di un tag specifico dato il suo contenuto testuale
 * Es: se cerco "Prodotti DOP" e nell'HTML c'è <h1>Prodotti DOP</h1>
 * restituisce "Prodotti DOP"
 */
function findTagContent(segment: string, html: string): { tag: string; fullContent: string; position: number } | null {
  // Il segmento potrebbe essere:
  // 1. Testo semplice dentro un tag: <h1>Testo</h1>
  // 2. Testo con tag inline: <p>Testo con <strong>grassetto</strong> dentro</p>

  // Cerca la posizione esatta del segmento nell'HTML
  const pos = html.indexOf(segment);
  if (pos === -1) return null;

  // Trova il tag che contiene questo segmento
  // Cerca indietro per trovare l'apertura del tag
  let tagStart = pos;
  while (tagStart > 0 && html[tagStart] !== '>') {
    tagStart--;
  }

  // Trova il nome del tag
  let tagNameStart = tagStart;
  while (tagNameStart > 0 && html[tagNameStart] !== '<') {
    tagNameStart--;
  }

  const tagMatch = html.substring(tagNameStart, tagStart + 1).match(/<(\w+)/);
  const tagName = tagMatch ? tagMatch[1] : 'unknown';

  return {
    tag: tagName,
    fullContent: segment,
    position: pos
  };
}

/**
 * Trova la traduzione di un segmento cercandolo per posizione strutturale
 */
function findTranslation(segment: string, itHtml: string, targetHtml: string): string | null {
  // Trova dove appare il segmento nell'HTML italiano
  const itPos = itHtml.indexOf(segment);
  if (itPos === -1) return null;

  // Conta quanti tag di apertura ci sono prima di questa posizione
  // Questo ci dà la "posizione strutturale"
  const beforeSegment = itHtml.substring(0, itPos);

  // Conta i tag principali (h1, h2, h3, p, li, ul)
  const tagCounts: Record<string, number> = {};
  const tagRegex = /<(h[1-6]|p|li|ul|ol|strong|em|a)[^>]*>/gi;
  let match;
  while ((match = tagRegex.exec(beforeSegment)) !== null) {
    const tag = match[1].toLowerCase();
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }

  // Trova il tag che contiene immediatamente il segmento
  // Cerca il > più vicino prima del segmento
  let lastTagEnd = beforeSegment.lastIndexOf('>');
  if (lastTagEnd === -1) return null;

  // Trova l'apertura di quel tag
  let tagOpenStart = beforeSegment.lastIndexOf('<', lastTagEnd);
  const containingTag = beforeSegment.substring(tagOpenStart, lastTagEnd + 1);
  const tagNameMatch = containingTag.match(/<(\w+)/);
  const containerTag = tagNameMatch ? tagNameMatch[1].toLowerCase() : null;

  if (!containerTag) return null;

  // Ora cerca lo stesso pattern nell'HTML target:
  // Trova l'N-esimo tag dello stesso tipo
  const tagCountBefore = tagCounts[containerTag] || 0;

  // Trova tutti i tag di quel tipo nell'HTML target
  const targetTagRegex = new RegExp(`<${containerTag}[^>]*>`, 'gi');
  let count = 0;
  let targetMatch;
  let targetTagPos = -1;

  while ((targetMatch = targetTagRegex.exec(targetHtml)) !== null) {
    if (count === tagCountBefore) {
      targetTagPos = targetMatch.index + targetMatch[0].length;
      break;
    }
    count++;
  }

  if (targetTagPos === -1) return null;

  // Trova la fine del contenuto del tag (il prossimo tag di chiusura o apertura di blocco)
  const closeTag = `</${containerTag}>`;
  let targetEndPos = targetHtml.indexOf(closeTag, targetTagPos);
  if (targetEndPos === -1) {
    // Prova a trovare il prossimo tag di apertura
    const nextTagMatch = targetHtml.substring(targetTagPos).match(/<[a-z]/i);
    if (nextTagMatch) {
      targetEndPos = targetTagPos + nextTagMatch.index!;
    } else {
      return null;
    }
  }

  // Estrai il contenuto
  let targetContent = targetHtml.substring(targetTagPos, targetEndPos);

  // Se il segmento originale ha una lunghezza specifica, prendi solo quella parte
  // (per gestire segmenti parziali)
  const segmentTextLen = segment.replace(/<[^>]+>/g, '').length;
  const targetTextOnly = targetContent.replace(/<[^>]+>/g, '');

  if (targetTextOnly.length > segmentTextLen * 1.5) {
    // Il contenuto target è molto più lungo, probabilmente abbiamo preso troppo
    // Prendi solo la parte proporzionale
    targetContent = targetTextOnly.substring(0, Math.ceil(segmentTextLen * 1.2));
  }

  return targetContent.trim() || null;
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

  // 4. Traduci
  console.log('\n🌍 Traduco...');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    const translations: Record<string, string> = {};
    let found = 0;

    for (const src of sources) {
      const trans = findTranslation(src, itData.content_html, langData.content_html);
      if (trans && trans !== src && !trans.includes('<')) {
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
        console.log(`   ✅ OK`);
      } catch (e: any) {
        console.log(`   ❌ ${e.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`\n✅ ID: ${postId}`);
  return postId;
}

const articlePath = process.argv[2] || 'data/new-articles/article-09-thurgau.json';
uploadArticle(articlePath).catch(console.error);
