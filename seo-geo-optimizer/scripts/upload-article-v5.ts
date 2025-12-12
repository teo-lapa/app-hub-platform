/**
 * Upload articolo SEO+GEO su Odoo con traduzioni corrette
 * Versione 5: Estrae testi nell'ordine in cui appaiono e li mappa per posizione
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
 * Estrae tutti i frammenti di testo dall'HTML nell'ordine esatto
 * Odoo spezza il testo ogni volta che incontra un tag inline (strong, em, a, etc.)
 */
function extractTextFragments(html: string): string[] {
  const fragments: string[] = [];

  // Rimuovi i tag di blocco/struttura (section, div, container, row, col)
  // ma mantieni il contenuto
  let cleaned = html
    .replace(/<section[^>]*>/gi, '')
    .replace(/<\/section>/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '');

  // Ora estrai i testi alternando tra "fuori tag" e "dentro tag"
  // Pattern: testo > tag > testo > /tag > testo > tag > ...
  const regex = />([^<]+)</g;
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 0) {
      fragments.push(text);
    }
  }

  return fragments;
}

/**
 * Crea un mapping che associa ogni frammento IT al corrispondente frammento target
 * basandosi sull'ordine di apparizione
 */
function createFragmentMapping(itHtml: string, targetHtml: string): Map<string, string> {
  const itFragments = extractTextFragments(itHtml);
  const targetFragments = extractTextFragments(targetHtml);

  const mapping = new Map<string, string>();

  // Per ogni frammento italiano, trova il corrispondente target
  // Usiamo l'indice perché la struttura HTML è identica
  for (let i = 0; i < itFragments.length && i < targetFragments.length; i++) {
    const itFrag = itFragments[i];
    const targetFrag = targetFragments[i];

    // Aggiungi solo se sono diversi (traduzione effettiva)
    if (itFrag !== targetFrag) {
      mapping.set(itFrag, targetFrag);
    }
  }

  return mapping;
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

  // 3. Leggi segmenti da Odoo
  console.log('\n📖 Leggo segmenti Odoo...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  if (!segmentData?.[0]?.length) {
    console.log('   Nessun segmento');
    return postId;
  }

  const sources = [...new Set(segmentData[0].map((s: any) => s.source))] as string[];
  console.log(`   ${sources.length} segmenti unici`);

  // Debug: mostra primi segmenti
  console.log('\n   Primi 5 segmenti Odoo:');
  sources.slice(0, 5).forEach((s, i) => {
    console.log(`   ${i+1}. "${s.substring(0, 50)}${s.length > 50 ? '...' : ''}"`);
  });

  // 4. Traduci ogni lingua
  console.log('\n🌍 Traduco content...');

  // Estrai frammenti dall'HTML italiano per debug
  const itFragments = extractTextFragments(itData.content_html);
  console.log(`   Frammenti estratti da IT HTML: ${itFragments.length}`);

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    // Crea mapping frammenti
    const fragmentMap = createFragmentMapping(itData.content_html, langData.content_html);
    console.log(`\n   ${odooLang}: ${fragmentMap.size} traduzioni nel mapping`);

    // Per ogni segmento Odoo, cerca nel mapping
    const translations: Record<string, string> = {};
    let matched = 0;
    let notFound = 0;

    for (const src of sources) {
      // Cerca match esatto
      if (fragmentMap.has(src)) {
        translations[src] = fragmentMap.get(src)!;
        matched++;
      } else {
        // Cerca match parziale (il segmento potrebbe essere contenuto in un frammento)
        let found = false;
        for (const [itFrag, targetFrag] of fragmentMap.entries()) {
          if (src === itFrag || itFrag.includes(src)) {
            // Se il segmento è uguale o contenuto nel frammento
            if (src === itFrag) {
              translations[src] = targetFrag;
            } else {
              // Trova la sottostringa corrispondente
              const startIdx = itFrag.indexOf(src);
              if (startIdx !== -1) {
                // Calcola proporzione e estrai dal target
                const ratio = startIdx / itFrag.length;
                const targetStart = Math.round(ratio * targetFrag.length);
                const targetLen = Math.round((src.length / itFrag.length) * targetFrag.length);
                const extracted = targetFrag.substring(targetStart, targetStart + targetLen);
                if (extracted.length > 0) {
                  translations[src] = extracted;
                }
              }
            }
            matched++;
            found = true;
            break;
          }
        }
        if (!found) notFound++;
      }
    }

    console.log(`   Matched: ${matched}, Not found: ${notFound}`);

    if (Object.keys(translations).length > 0) {
      try {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId], 'content', { [odooLang]: translations }
        ]);
        console.log(`   ✅ Applicato`);
      } catch (e: any) {
        console.log(`   ❌ ${e.message.substring(0, 100)}`);
      }
    }
  }

  console.log(`\n✅ FATTO! ID: ${postId}`);
  return postId;
}

const articlePath = process.argv[2] || 'data/new-articles/article-09-thurgau.json';
uploadArticle(articlePath).catch(console.error);
