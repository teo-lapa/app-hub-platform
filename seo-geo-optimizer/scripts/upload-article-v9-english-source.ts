/**
 * Upload articolo con traduzioni al 100% - V9
 * ENGLISH AS SOURCE: Odoo uses English segments as source
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
 * Normalizza testo per matching
 */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/\n/g, ' ');
}

/**
 * Estrai TUTTE le celle di TUTTE le tabelle in ordine (SENZA normalizzare)
 */
function extractAllTableCellsInOrder(html: string): string[] {
  const allCells: string[] = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(tableContent)) !== null) {
      const cell = cellMatch[1].trim(); // Solo trim, NON normalize
      if (cell) {
        allCells.push(cell);
      }
    }
  }

  return allCells;
}

/**
 * Estrai tutti i paragrafi con la loro posizione (SENZA normalizzare)
 */
function extractAllParagraphs(html: string): Array<{content: string, position: number}> {
  const paragraphs: Array<{content: string, position: number}> = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = pRegex.exec(html)) !== null) {
    const content = match[1].trim(); // Solo trim
    if (content && content.length > 5) { // Ignora paragrafi troppo corti
      paragraphs.push({
        content,
        position: match.index
      });
    }
  }

  return paragraphs;
}

/**
 * Estrai TUTTI i tag inline (strong, em, etc) con il loro contenuto completo
 */
function extractInlineTags(html: string): string[] {
  const tags: string[] = [];
  const tagTypes = ['strong', 'em', 'b', 'i', 'span', 'a'];

  for (const tag of tagTypes) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      const fullTag = match[0].trim();
      if (fullTag) {
        tags.push(fullTag);
      }
    }
  }

  return tags;
}

/**
 * Estrai headings (SENZA normalizzare)
 */
function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  for (let level = 1; level <= 6; level++) {
    const regex = new RegExp(`<h${level}[^>]*>([^<]+)</h${level}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      headings.push(match[1].trim()); // Solo trim
    }
  }
  return headings;
}

/**
 * Estrai elementi di lista (SENZA normalizzare)
 */
function extractListItems(html: string): string[] {
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = liRegex.exec(html)) !== null) {
    const content = match[1].trim(); // Solo trim
    if (content) {
      items.push(content);
    }
  }

  return items;
}

/**
 * Calcola similarità tra due stringhe (0-1)
 */
function similarity(s1: string, s2: string): number {
  // Rimuovi tag HTML
  const t1 = s1.replace(/<[^>]+>/g, '').toLowerCase();
  const t2 = s2.replace(/<[^>]+>/g, '').toLowerCase();

  if (t1 === t2) return 1.0;
  if (t1.length === 0 || t2.length === 0) return 0.0;

  // Conta parole in comune
  const words1 = new Set(t1.split(/\s+/));
  const words2 = new Set(t2.split(/\s+/));

  let common = 0;
  for (const word of words1) {
    if (words2.has(word)) common++;
  }

  const total = Math.max(words1.size, words2.size);
  return total > 0 ? common / total : 0;
}

/**
 * Matching PERFETTO al 100%
 */
function findPerfectTranslation(
  segment: string,
  itHtml: string,
  targetHtml: string,
  itTableCells: string[],
  targetTableCells: string[],
  itParagraphs: Array<{content: string, position: number}>,
  targetParagraphs: Array<{content: string, position: number}>,
  itHeadings: string[],
  targetHeadings: string[],
  itListItems: string[],
  targetListItems: string[],
  itInlineTags: string[],
  targetInlineTags: string[]
): string | null {
  const seg = normalize(segment);
  const segOriginal = segment.trim(); // Mantieni anche l'originale

  // Strategia 0: Match ESATTO senza normalizzazione
  let idx = itTableCells.findIndex(c => c === segOriginal);
  if (idx >= 0 && idx < targetTableCells.length) {
    return targetTableCells[idx];
  }

  idx = itListItems.findIndex(c => c === segOriginal);
  if (idx >= 0 && idx < targetListItems.length) {
    return targetListItems[idx];
  }

  idx = itHeadings.findIndex(c => c === segOriginal);
  if (idx >= 0 && idx < targetHeadings.length) {
    return targetHeadings[idx];
  }

  idx = itInlineTags.findIndex(c => c === segOriginal);
  if (idx >= 0 && idx < targetInlineTags.length) {
    return targetInlineTags[idx];
  }

  // Strategia 1: Match con normalizzazione
  idx = itHeadings.findIndex(c => normalize(c) === seg);
  if (idx >= 0 && idx < targetHeadings.length) {
    return targetHeadings[idx];
  }

  idx = itTableCells.findIndex(c => normalize(c) === seg);
  if (idx >= 0 && idx < targetTableCells.length) {
    return targetTableCells[idx];
  }

  idx = itListItems.findIndex(c => normalize(c) === seg);
  if (idx >= 0 && idx < targetListItems.length) {
    return targetListItems[idx];
  }

  idx = itInlineTags.findIndex(c => normalize(c) === seg);
  if (idx >= 0 && idx < targetInlineTags.length) {
    return targetInlineTags[idx];
  }

  // Strategia 4: Match in paragrafi per posizione relativa
  const segNoTags = seg.replace(/<[^>]+>/g, '');
  idx = itParagraphs.findIndex(p => {
    const pNoTags = p.content.replace(/<[^>]+>/g, '');
    return pNoTags.includes(segNoTags) || segNoTags.includes(pNoTags);
  });

  if (idx >= 0) {
    // Trova il paragrafo corrispondente nel target
    if (idx < targetParagraphs.length) {
      // Se il segmento è una parte del paragrafo, trova la parte corrispondente
      const itPara = itParagraphs[idx].content;
      const targetPara = targetParagraphs[idx].content;

      // Se il segmento è l'intero paragrafo
      if (normalize(itPara) === seg) {
        return targetPara;
      }

      // Se il segmento è una parte, cerca per posizione relativa
      const segStartInPara = itPara.indexOf(segNoTags);
      if (segStartInPara >= 0) {
        // Calcola la posizione relativa (inizio, metà, fine)
        const relativePos = segStartInPara / itPara.length;

        // Cerca nella stessa posizione relativa nel paragrafo target
        const targetWords = targetPara.split(/\s+/);
        const targetStartWord = Math.floor(targetWords.length * relativePos);
        const segWordCount = segNoTags.split(/\s+/).length;

        const extracted = targetWords.slice(targetStartWord, targetStartWord + segWordCount + 2).join(' ');
        if (extracted) return extracted;
      }
    }
  }

  // Strategia 5: Match fuzzy (per segmenti corti o celle di tabella)
  if (segNoTags.length < 30) {
    // Cerca in tutte le celle di tabella con similarità > 0.5
    let bestMatch: string | null = null;
    let bestScore = 0.5;

    for (const cell of targetTableCells) {
      const score = similarity(seg, cell);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cell;
      }
    }

    if (bestMatch) return bestMatch;

    // Cerca in liste
    for (const item of targetListItems) {
      const score = similarity(seg, item);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch) return bestMatch;
  }

  // Strategia 6: Matching posizionale (fallback)
  const itPos = itHtml.indexOf(segment);
  if (itPos === -1) return null;

  // Calcola posizione relativa nel documento (0-1)
  const relativePos = itPos / itHtml.length;

  // Cerca nella stessa posizione relativa nel documento target
  const targetPos = Math.floor(targetHtml.length * relativePos);
  const searchWindow = 500; // Cerca in una finestra di 500 caratteri

  const targetSegment = targetHtml.substring(
    Math.max(0, targetPos - searchWindow),
    Math.min(targetHtml.length, targetPos + searchWindow)
  );

  // Cerca un tag dello stesso tipo
  const tagMatch = segment.match(/<(\w+)/);
  if (tagMatch) {
    const tagType = tagMatch[1];
    const regex = new RegExp(`<${tagType}[^>]*>([\\s\\S]*?)</${tagType}>`, 'i');
    const match = regex.exec(targetSegment);
    if (match) {
      return normalize(match[1]);
    }
  }

  return null;
}

async function uploadArticle(articlePath: string) {
  console.log(`📄 ${articlePath}\n`);

  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));

  console.log('🔐 Auth...');
  await authenticate();
  console.log('✅\n');

  const itData = article.translations.it_IT;

  console.log('🇮🇹 Create...');
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

  console.log('📝 Meta...');
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

  console.log('\n📖 Segments...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  if (!segmentData?.[0]?.length) {
    console.log('   None');
    return postId;
  }

  const sources = [...new Set(segmentData[0].map((s: any) => s.source))] as string[];
  console.log(`   ${sources.length}\n`);

  console.log('🔍 Analyze SOURCE (English)...');
  const enData = article.translations.en_US;
  const enTableCells = extractAllTableCellsInOrder(enData.content_html);
  const enParagraphs = extractAllParagraphs(enData.content_html);
  const enHeadings = extractHeadings(enData.content_html);
  const enListItems = extractListItems(enData.content_html);
  const enInlineTags = extractInlineTags(enData.content_html);
  console.log(`   Tables: ${enTableCells.length} cells`);
  console.log(`   Paras: ${enParagraphs.length}`);
  console.log(`   Headings: ${enHeadings.length}`);
  console.log(`   Lists: ${enListItems.length}`);
  console.log(`   Inline: ${enInlineTags.length}\n`);

  console.log('🌍 Translate...\n');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    // Translate ALL languages (Odoo uses English segment sources, but all langs need translations)
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    console.log(`   ${odooLang}...`);

    const targetTableCells = extractAllTableCellsInOrder(langData.content_html);
    const targetParagraphs = extractAllParagraphs(langData.content_html);
    const targetHeadings = extractHeadings(langData.content_html);
    const targetListItems = extractListItems(langData.content_html);
    const targetInlineTags = extractInlineTags(langData.content_html);

    const translations: Record<string, string> = {};
    let found = 0;

    for (const src of sources) {
      const trans = findPerfectTranslation(
        src,
        enData.content_html,
        langData.content_html,
        enTableCells,
        targetTableCells,
        enParagraphs,
        targetParagraphs,
        enHeadings,
        targetHeadings,
        enListItems,
        targetListItems,
        enInlineTags,
        targetInlineTags
      );

      if (trans && normalize(trans) !== normalize(src) && trans.trim().length > 0) {
        translations[src] = trans;
        found++;
      }
    }

    const percent = Math.round((found / sources.length) * 100);
    console.log(`     ${found}/${sources.length} (${percent}%)`);

    if (Object.keys(translations).length > 0) {
      await callOdoo('blog.post', 'update_field_translations', [
        [postId], 'content', { [odooLang]: translations }
      ]);
      console.log(`     ✅`);
    }
  }

  console.log(`\n✅ ${postId}`);
  return postId;
}

const articlePath = process.argv[2];
if (!articlePath) {
  console.error('Usage: npx tsx upload-article-v8-perfect.ts <path>');
  process.exit(1);
}

uploadArticle(articlePath).catch(console.error);
