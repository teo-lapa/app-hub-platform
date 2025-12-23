/**
 * Upload articolo con traduzioni al 100%
 * Versione 7: Matching intelligente per tabelle, liste e tag inline
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
 * Estrai tutti gli elementi di un certo tipo con il loro contenuto
 */
function extractElements(html: string, tag: string): string[] {
  const elements: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
      elements.push(content);
    }
  }
  return elements;
}

/**
 * Estrai celle di tabella
 */
function extractTableCells(html: string): Map<number, string[]> {
  const tables = new Map<number, string[]>();
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  let tableIndex = 0;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    const cells: string[] = [];

    // Estrai tutte le celle (th e td) - INCLUSO contenuto con tag HTML
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(tableContent)) !== null) {
      const cell = cellMatch[1].trim();
      if (cell) {
        cells.push(cell);
      }
    }

    tables.set(tableIndex, cells);
    tableIndex++;
  }

  return tables;
}

/**
 * Estrai tag inline (strong, em, etc) con il loro contenuto
 */
function extractInlineTags(html: string): Map<string, string[]> {
  const tags = new Map<string, string[]>();
  const tagTypes = ['strong', 'em', 'b', 'i', 'span'];

  for (const tag of tagTypes) {
    const elements = extractElements(html, tag);
    if (elements.length > 0) {
      tags.set(tag, elements);
    }
  }

  return tags;
}

/**
 * Matching intelligente che combina più strategie
 */
function findTranslationSmart(
  segment: string,
  itHtml: string,
  targetHtml: string,
  itTableCells: Map<number, string[]>,
  targetTableCells: Map<number, string[]>,
  itInlineTags: Map<string, string[]>,
  targetInlineTags: Map<string, string[]>
): string | null {
  const seg = segment.trim();

  // Strategia 1: Cerca nelle celle di tabella
  for (const [tableIdx, itCells] of itTableCells.entries()) {
    const cellIdx = itCells.indexOf(seg);
    if (cellIdx >= 0) {
      const targetCells = targetTableCells.get(tableIdx);
      if (targetCells && cellIdx < targetCells.length) {
        return targetCells[cellIdx];
      }
    }
  }

  // Strategia 2: Cerca nei tag inline (cerca pattern con tag)
  if (seg.includes('<strong>') || seg.includes('<em>') || seg.includes('<b>')) {
    // Estrai il tipo di tag
    const tagMatch = seg.match(/<(\w+)>/);
    if (tagMatch) {
      const tagType = tagMatch[1];
      const itTags = itInlineTags.get(tagType);
      const targetTags = targetInlineTags.get(tagType);

      if (itTags && targetTags) {
        const tagIdx = itTags.findIndex(t => seg.includes(t));
        if (tagIdx >= 0 && tagIdx < targetTags.length) {
          // Ricostruisci con lo stesso pattern
          return seg.replace(itTags[tagIdx], targetTags[tagIdx]);
        }
      }
    }
  }

  // Strategia 3: Matching per liste (elementi che iniziano con emoji o bullet)
  if (seg.match(/^(✅|❌|🍷|👉|🛡️|📧|📞|🌐|-|\d+\.)\s/)) {
    const prefix = seg.match(/^(✅|❌|🍷|👉|🛡️|📧|📞|🌐|-|\d+\.)\s/)?.[0];
    if (prefix) {
      // Trova tutte le liste con lo stesso prefix
      const itLists = itHtml.match(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n<]+`, 'g')) || [];
      const targetLists = targetHtml.match(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n<]+`, 'g')) || [];

      const listIdx = itLists.indexOf(seg);
      if (listIdx >= 0 && listIdx < targetLists.length) {
        return targetLists[listIdx];
      }
    }
  }

  // Strategia 4: Matching posizionale (originale findTranslation logic)
  const itPos = itHtml.indexOf(seg);
  if (itPos === -1) return null;

  // Conta i tag principali prima di questa posizione
  const beforeSegment = itHtml.substring(0, itPos);
  const tagCounts: Record<string, number> = {};
  const tagRegex = /<(h[1-6]|p|li|ul|ol|table|tr|td|th|div)[^>]*>/gi;
  let match;
  while ((match = tagRegex.exec(beforeSegment)) !== null) {
    const tag = match[1].toLowerCase();
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }

  // Trova il tag contenitore
  let lastTagEnd = beforeSegment.lastIndexOf('>');
  if (lastTagEnd === -1) return null;

  let tagOpenStart = beforeSegment.lastIndexOf('<', lastTagEnd);
  const containingTag = beforeSegment.substring(tagOpenStart, lastTagEnd + 1);
  const tagNameMatch = containingTag.match(/<(\w+)/);
  const containerTag = tagNameMatch ? tagNameMatch[1].toLowerCase() : null;

  if (!containerTag) return null;

  // Trova lo stesso tag nell'HTML target
  const tagCountBefore = tagCounts[containerTag] || 0;
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

  // Trova la fine del contenuto
  const closeTag = `</${containerTag}>`;
  let targetEndPos = targetHtml.indexOf(closeTag, targetTagPos);
  if (targetEndPos === -1) {
    const nextTagMatch = targetHtml.substring(targetTagPos).match(/<[a-z]/i);
    if (nextTagMatch) {
      targetEndPos = targetTagPos + nextTagMatch.index!;
    } else {
      return null;
    }
  }

  let targetContent = targetHtml.substring(targetTagPos, targetEndPos).trim();

  // Limita la lunghezza se necessario
  const segmentTextLen = seg.replace(/<[^>]+>/g, '').length;
  const targetTextOnly = targetContent.replace(/<[^>]+>/g, '');

  if (targetTextOnly.length > segmentTextLen * 2) {
    // Contenuto troppo lungo, prendi solo una parte proporzionale
    const words = targetTextOnly.split(/\s+/);
    const segWords = seg.replace(/<[^>]+>/g, '').split(/\s+/).length;
    targetContent = words.slice(0, Math.max(segWords, 1)).join(' ');
  }

  return targetContent || null;
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

  // Pre-estrai elementi per matching veloce
  console.log('\n🔍 Analizzo struttura HTML...');
  const itTableCells = extractTableCells(itData.content_html);
  const itInlineTags = extractInlineTags(itData.content_html);

  // Estrai headings
  function extractHeadings(html: string): string[] {
    const headings: string[] = [];
    for (let level = 1; level <= 6; level++) {
      const regex = new RegExp(`<h${level}[^>]*>([^<]+)</h${level}>`, 'gi');
      let match;
      while ((match = regex.exec(html)) !== null) {
        headings.push(match[1].trim());
      }
    }
    return headings;
  }

  const itHeadings = extractHeadings(itData.content_html);

  // 4. Traduci per ogni lingua
  console.log('\n🌍 Traduco contenuto...\n');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    console.log(`   ${odooLang}...`);

    // Pre-estrai per questa lingua
    const targetTableCells = extractTableCells(langData.content_html);
    const targetInlineTags = extractInlineTags(langData.content_html);
    const targetHeadings = extractHeadings(langData.content_html);

    const translations: Record<string, string> = {};
    let found = 0;

    for (const src of sources) {
      let trans: string | null = null;

      // Prova 1: Matching headings
      const headingIdx = itHeadings.indexOf(src.trim());
      if (headingIdx >= 0 && headingIdx < targetHeadings.length) {
        trans = targetHeadings[headingIdx];
      } else {
        // Prova 2: Matching intelligente
        trans = findTranslationSmart(
          src,
          itData.content_html,
          langData.content_html,
          itTableCells,
          targetTableCells,
          itInlineTags,
          targetInlineTags
        );
      }

      if (trans && trans !== src && trans.trim().length > 0) {
        translations[src] = trans;
        found++;
      }
    }

    console.log(`     ${found}/${sources.length} (${Math.round(found/sources.length*100)}%)`);

    if (Object.keys(translations).length > 0) {
      try {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId], 'content', { [odooLang]: translations }
        ]);
        console.log(`     ✅ OK`);
      } catch (e: any) {
        console.log(`     ❌ ${e.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`\n✅ ID: ${postId}`);
  return postId;
}

const articlePath = process.argv[2];
if (!articlePath) {
  console.error('❌ Specifica il path dell\'articolo');
  console.error('Uso: npx tsx upload-article-v7.ts <path>');
  process.exit(1);
}

uploadArticle(articlePath).catch(console.error);
