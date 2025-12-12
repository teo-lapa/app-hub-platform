/**
 * Upload articolo SEO+GEO su Odoo con traduzioni corrette
 * Versione 3: Matching basato su segmenti Odoo con tag HTML
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
 * Trova la posizione di un segmento nell'HTML e restituisce
 * il segmento equivalente dall'HTML target
 */
function findCorrespondingSegment(segment: string, itHtml: string, targetHtml: string): string | null {
  // Trova dove appare questo segmento nell'HTML italiano
  const itIndex = itHtml.indexOf(segment);
  if (itIndex === -1) {
    // Prova senza i primi/ultimi caratteri (potrebbero essere troncati)
    return null;
  }

  // Trova il contesto attorno al segmento
  // Cerca il tag che lo contiene
  const beforeSegment = itHtml.substring(Math.max(0, itIndex - 100), itIndex);
  const afterSegment = itHtml.substring(itIndex + segment.length, itIndex + segment.length + 50);

  // Trova il tag di apertura più vicino
  const tagMatch = beforeSegment.match(/<([a-z][a-z0-9]*)[^>]*>$/i);
  if (!tagMatch) {
    return null;
  }

  const tagName = tagMatch[1];

  // Ora cerca lo stesso pattern nell'HTML target
  // Conta quante volte appare questo tag prima della nostra posizione
  const itBeforeFull = itHtml.substring(0, itIndex);
  const tagRegex = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const occurrencesInIt = (itBeforeFull.match(tagRegex) || []).length;

  // Trova la stessa occorrenza nell'HTML target
  let count = 0;
  let targetIndex = 0;
  let match;

  while (count <= occurrencesInIt) {
    const searchFrom = count === 0 ? 0 : targetIndex + 1;
    const remaining = targetHtml.substring(searchFrom);
    const found = remaining.search(tagRegex);

    if (found === -1) break;

    targetIndex = searchFrom + found;
    count++;
  }

  if (count <= occurrencesInIt) {
    return null;
  }

  // Trova il tag di chiusura corrispondente
  const closeTag = `</${tagName}>`;
  const tagStart = targetHtml.indexOf('>', targetIndex) + 1;
  const tagEnd = targetHtml.indexOf(closeTag, tagStart);

  if (tagEnd === -1) return null;

  const targetSegment = targetHtml.substring(tagStart, tagEnd);

  // Se il segmento originale ha tag interni, il target dovrebbe averli nella stessa posizione
  return targetSegment;
}

/**
 * Estrae tutti i "blocchi" traducibili dall'HTML
 * Un blocco è il contenuto di un tag che non contiene altri tag blocco
 */
function extractTranslatableBlocks(html: string): { content: string; start: number; end: number }[] {
  const blocks: { content: string; start: number; end: number }[] = [];

  // Tags che contengono testo traducibile
  const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'span', 'strong', 'em', 'a'];

  for (const tag of blockTags) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      const content = match[1].trim();
      if (content && content.length > 1) {
        blocks.push({
          content,
          start: match.index + match[0].indexOf('>') + 1,
          end: match.index + match[0].lastIndexOf('<')
        });
      }
    }
  }

  return blocks.sort((a, b) => a.start - b.start);
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

  // 2. Traduci campi semplici
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

  // 3. Leggi segmenti Odoo
  console.log('\n📖 Leggo segmenti content...');

  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  if (!segmentData?.[0]?.length) {
    console.log('   ⚠️ Nessun segmento trovato');
    return postId;
  }

  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map((s: any) => s.source))] as string[];
  console.log(`   ${sourceTexts.length} segmenti unici`);

  // Analizza i segmenti
  console.log('\n   Analisi segmenti:');
  let withHtml = 0;
  let plainText = 0;
  for (const s of sourceTexts) {
    if (/<[^>]+>/.test(s)) withHtml++;
    else plainText++;
  }
  console.log(`   - Con HTML: ${withHtml}`);
  console.log(`   - Solo testo: ${plainText}`);

  // 4. Crea mapping basato su blocchi ordinati
  console.log('\n🌍 Creo mapping traduzioni...');

  // Estrai blocchi ordinati da IT e ogni altra lingua
  const itBlocks = extractTranslatableBlocks(itData.content_html);
  console.log(`   IT: ${itBlocks.length} blocchi estratti`);

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    const targetBlocks = extractTranslatableBlocks(langData.content_html);
    console.log(`   ${odooLang}: ${targetBlocks.length} blocchi`);

    // Crea mapping IT -> target per posizione
    const blockMap = new Map<string, string>();
    const minLen = Math.min(itBlocks.length, targetBlocks.length);
    for (let i = 0; i < minLen; i++) {
      if (itBlocks[i].content !== targetBlocks[i].content) {
        blockMap.set(itBlocks[i].content, targetBlocks[i].content);
      }
    }

    // Ora per ogni segmento Odoo, cerca nel blockMap
    const segmentTranslations: Record<string, string> = {};

    for (const srcText of sourceTexts) {
      // Match esatto
      if (blockMap.has(srcText)) {
        segmentTranslations[srcText] = blockMap.get(srcText)!;
        continue;
      }

      // Il segmento potrebbe essere un sottotesto o contenere HTML
      // Prova a trovare un blocco che lo contiene
      for (const [itBlock, targetBlock] of blockMap.entries()) {
        if (itBlock.includes(srcText)) {
          // Trova la stessa sottostringa nel target
          const startIdx = itBlock.indexOf(srcText);
          const endIdx = startIdx + srcText.length;

          // Proporzione nel blocco italiano
          const startRatio = startIdx / itBlock.length;
          const endRatio = endIdx / itBlock.length;

          // Applica stessa proporzione al blocco target
          const targetStart = Math.floor(startRatio * targetBlock.length);
          const targetEnd = Math.floor(endRatio * targetBlock.length);

          // Questa è un'approssimazione - potrebbe non essere perfetta
          // ma per testi simili dovrebbe funzionare
          const approxTranslation = targetBlock.substring(targetStart, targetEnd);

          if (approxTranslation && approxTranslation.length > 3) {
            segmentTranslations[srcText] = approxTranslation;
          }
          break;
        }

        // O il blocco è contenuto nel segmento
        if (srcText.includes(itBlock)) {
          segmentTranslations[srcText] = srcText.replace(itBlock, targetBlock);
          break;
        }
      }
    }

    console.log(`   ${odooLang}: ${Object.keys(segmentTranslations).length}/${sourceTexts.length} traduzioni`);

    // Applica
    if (Object.keys(segmentTranslations).length > 0) {
      try {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId], 'content', { [odooLang]: segmentTranslations }
        ]);
        console.log(`   ✅ Applicato`);
      } catch (e: any) {
        console.log(`   ❌ ${e.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`\n✅ COMPLETATO! ID: ${postId}`);
  return postId;
}

const articlePath = process.argv[2] || 'data/new-articles/article-09-thurgau.json';
uploadArticle(articlePath).catch(console.error);
