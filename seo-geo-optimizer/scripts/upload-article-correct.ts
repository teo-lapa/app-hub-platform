/**
 * Upload articolo SEO+GEO su Odoo con traduzioni corrette
 * Usa lo stesso metodo della LAPA App Platform
 */

import { readFileSync } from 'fs';

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

// Language mapping: article JSON uses de_DE/fr_FR, Odoo uses de_CH/fr_CH
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

// Helper per estrarre testi da HTML (per il mapping)
function extractTextBlocks(html: string): string[] {
  const blocks: string[] = [];

  // Estrai testo da tutti i tag comuni
  const regex = />([^<]+)</g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 1 && !/^\s*$/.test(text)) {
      blocks.push(text);
    }
  }

  return blocks;
}

async function uploadArticle(articlePath: string) {
  console.log(`📄 Caricamento articolo: ${articlePath}\n`);

  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));

  console.log('🔐 Autenticazione Odoo...');
  await authenticate();
  console.log('✅ Autenticato\n');

  // Dati italiano (lingua base)
  const itData = article.translations.it_IT;

  // 1. Crea articolo in italiano
  console.log('🇮🇹 Creo articolo in ITALIANO (lingua base)...');

  const postId = await callOdoo('blog.post', 'create', [{
    name: itData.name,
    subtitle: itData.subtitle,
    content: itData.content_html,
    blog_id: 4, // LAPABlog
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    is_published: false
  }], { context: { lang: 'it_IT' } });

  console.log(`   ✅ Articolo creato ID: ${postId}\n`);

  // 2. Traduci name e subtitle per ogni lingua
  console.log('📝 Traduco name e subtitle...');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue; // Skip italiano (è già la base)

    const langData = article.translations[jsonLang];
    if (!langData) continue;

    // Scrivi name con context lingua
    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.name,
      subtitle: langData.subtitle,
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords,
    }], { context: { lang: odooLang } });

    console.log(`   ✅ ${odooLang}: name, subtitle, meta tradotti`);
  }

  // 3. Ora gestisco il content con il sistema di segmenti
  console.log('\n📖 Leggo segmenti del content...');

  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  if (!segmentData || !Array.isArray(segmentData) || segmentData.length === 0) {
    console.log('   ⚠️ Nessun segmento trovato nel content');
    return postId;
  }

  const segments = segmentData[0];
  const sourceTexts = Array.from(new Set(segments.map((s: any) => s.source))) as string[];
  console.log(`   ${sourceTexts.length} segmenti unici trovati`);

  // Estrai testi da ogni lingua per il mapping
  const itTexts = extractTextBlocks(itData.content_html);

  console.log('\n🌍 Traduco content per ogni lingua...');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;

    const langData = article.translations[jsonLang];
    if (!langData) continue;

    const langTexts = extractTextBlocks(langData.content_html);

    // Crea mapping source -> traduzione
    const segmentTranslations: Record<string, string> = {};

    for (const srcText of sourceTexts) {
      // Trova la posizione di questo testo nei testi italiani
      const itIdx = itTexts.findIndex(t => t === srcText);

      if (itIdx >= 0 && langTexts[itIdx]) {
        // Abbiamo la traduzione alla stessa posizione
        segmentTranslations[srcText] = langTexts[itIdx];
      } else {
        // Prova matching parziale
        const partialMatch = itTexts.findIndex(t => t.includes(srcText) || srcText.includes(t));
        if (partialMatch >= 0 && langTexts[partialMatch]) {
          segmentTranslations[srcText] = langTexts[partialMatch];
        }
      }
    }

    console.log(`   ${odooLang}: ${Object.keys(segmentTranslations).length} segmenti mappati`);

    // Applica traduzioni
    if (Object.keys(segmentTranslations).length > 0) {
      try {
        await callOdoo('blog.post', 'update_field_translations', [
          [postId],
          'content',
          { [odooLang]: segmentTranslations }
        ]);
        console.log(`   ✅ ${odooLang}: traduzioni applicate`);
      } catch (e: any) {
        console.log(`   ❌ ${odooLang}: errore - ${e.message.substring(0, 100)}`);
      }
    }
  }

  // 4. Verifica finale
  console.log('\n🔍 Verifica traduzioni...');

  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    const data = await callOdoo('blog.post', 'read', [[postId]], {
      fields: ['name', 'content'],
      context: { lang: odooLang }
    });

    const name = data[0]?.name || 'N/A';
    const h1Match = data[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const h1 = h1Match ? h1Match[1] : 'N/A';

    console.log(`   ${odooLang}:`);
    console.log(`      name: "${name.substring(0, 50)}..."`);
    console.log(`      H1: "${h1.substring(0, 50)}..."`);
  }

  console.log(`\n✅ COMPLETATO! Articolo ID: ${postId}`);
  console.log(`   URL: ${ODOO_URL}/blog/lapablog-4/${postId}`);

  return postId;
}

// Main
const articlePath = process.argv[2] || 'data/new-articles/article-01-zurich.json';
uploadArticle(articlePath).catch(console.error);
