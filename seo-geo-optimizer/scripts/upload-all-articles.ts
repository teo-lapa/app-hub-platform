/**
 * Upload TUTTI gli articoli SEO+GEO su Odoo con traduzioni
 */

import { readFileSync, readdirSync } from 'fs';

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

function extractTextBlocks(html: string): string[] {
  const blocks: string[] = [];
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

async function uploadArticle(articlePath: string): Promise<number> {
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  // 1. Crea articolo in italiano
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

  // 2. Traduci name, subtitle, meta per ogni lingua
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

  // 3. Gestisci content con segmenti
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);

  if (segmentData && Array.isArray(segmentData) && segmentData.length > 0) {
    const segments = segmentData[0];
    const sourceTexts = Array.from(new Set(segments.map((s: any) => s.source))) as string[];
    const itTexts = extractTextBlocks(itData.content_html);

    for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
      if (jsonLang === 'it_IT') continue;
      const langData = article.translations[jsonLang];
      if (!langData) continue;

      const langTexts = extractTextBlocks(langData.content_html);
      const segmentTranslations: Record<string, string> = {};

      for (const srcText of sourceTexts) {
        const itIdx = itTexts.findIndex(t => t === srcText);
        if (itIdx >= 0 && langTexts[itIdx]) {
          segmentTranslations[srcText] = langTexts[itIdx];
        }
      }

      if (Object.keys(segmentTranslations).length > 0) {
        try {
          await callOdoo('blog.post', 'update_field_translations', [
            [postId], 'content', { [odooLang]: segmentTranslations }
          ]);
        } catch (e) {
          // Ignora errori di traduzione
        }
      }
    }
  }

  return postId;
}

async function main() {
  console.log('🚀 Upload TUTTI gli articoli SEO+GEO su Odoo\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ Autenticato\n');

  // Trova tutti gli articoli
  const articlesDir = 'data/new-articles';
  const files = readdirSync(articlesDir)
    .filter(f => f.startsWith('article-') && f.endsWith('.json'))
    .sort();

  console.log(`📄 Trovati ${files.length} articoli da caricare\n`);

  const results: { file: string; postId: number; name: string }[] = [];

  for (const file of files) {
    const articlePath = `${articlesDir}/${file}`;
    const article = JSON.parse(readFileSync(articlePath, 'utf-8'));

    console.log(`📤 Caricamento: ${file}`);
    console.log(`   "${article.translations.it_IT.name.substring(0, 50)}..."`);

    try {
      const postId = await uploadArticle(articlePath);
      results.push({ file, postId, name: article.translations.it_IT.name });
      console.log(`   ✅ ID: ${postId}\n`);
    } catch (e: any) {
      console.log(`   ❌ Errore: ${e.message.substring(0, 100)}\n`);
    }

    // Pausa tra un articolo e l'altro
    await new Promise(r => setTimeout(r, 1000));
  }

  // Riepilogo
  console.log('\n' + '='.repeat(60));
  console.log('📊 RIEPILOGO CARICAMENTO');
  console.log('='.repeat(60) + '\n');

  for (const r of results) {
    console.log(`✅ ${r.file}`);
    console.log(`   ID: ${r.postId}`);
    console.log(`   "${r.name.substring(0, 50)}..."`);
    console.log(`   URL: ${ODOO_URL}/blog/lapablog-4/${r.postId}\n`);
  }

  console.log(`\n🎉 Caricati ${results.length}/${files.length} articoli con successo!`);
}

main().catch(console.error);
