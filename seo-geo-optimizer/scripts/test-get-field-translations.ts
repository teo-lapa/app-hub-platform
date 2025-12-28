/**
 * Test usando get_field_translations + update_field_translations
 * Questo è il metodo usato in upload-27-articles-final.cjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

const LANG_MAP: Record<string, string> = {
  'it_IT': 'it_IT',
  'de_DE': 'de_CH',
  'fr_FR': 'fr_CH',
  'en_US': 'en_US'
};

let cookies = '';

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

function extractTexts(html: string): string[] {
  const texts: string[] = [];
  const regex = />([^<]+)</g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 1 && !/^\s*$/.test(text)) {
      texts.push(text);
    }
  }
  return texts;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   TEST get_field_translations + update_field_translations  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  // Delete post 420 if exists
  try {
    await callOdoo('blog.post', 'unlink', [[420]], {});
    console.log('🗑️  Eliminato post 420\n');
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.log('⚠️  Post 420 non trovato\n');
  }

  // 1. Create post in Italian
  console.log('📝 Creazione post in italiano...\n');
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
  console.log(`✅ Creato post ID ${postId}\n`);

  // 2. Translate meta fields first
  console.log('🌍 Traduzioni meta fields...\n');
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang as keyof typeof article.translations];
    if (!langData) continue;

    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.name,
      subtitle: langData.subtitle,
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords
    }], { context: { lang: odooLang } });

    console.log(`   ✓ ${jsonLang}`);
  }

  // 3. Wait for Odoo to process
  console.log('\n⏳ Attendo 2 secondi per Odoo...\n');
  await new Promise(r => setTimeout(r, 2000));

  // 4. Get field translation segments from Odoo
  console.log('📋 Ottengo segmenti traduzione da Odoo...\n');

  try {
    const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});
    console.log('Risultato get_field_translations:');
    console.log(JSON.stringify(fieldTrans, null, 2).substring(0, 1000));
    console.log('\n...\n');

    if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
      const segments = fieldTrans[0];
      const sourceTexts = [...new Set(segments.map((s: any) => s.source))];
      console.log(`✅ Trovati ${sourceTexts.length} segmenti\n`);

      // 5. Extract texts from HTML
      const itTexts = extractTexts(itData.content_html);
      console.log(`📝 Estratti ${itTexts.length} testi dall'HTML italiano\n`);

      // 6. Create translations for each language
      console.log('🌐 Creazione traduzioni...\n');

      for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
        if (jsonLang === 'it_IT') continue;
        const langData = article.translations[jsonLang as keyof typeof article.translations];
        if (!langData) continue;

        const langTexts = extractTexts(langData.content_html);
        const translations: Record<string, string> = {};

        for (const srcText of sourceTexts) {
          const itIdx = itTexts.indexOf(srcText);
          if (itIdx >= 0 && langTexts[itIdx]) {
            translations[srcText] = langTexts[itIdx];
          }
        }

        if (Object.keys(translations).length > 0) {
          console.log(`   ${jsonLang}: ${Object.keys(translations).length} blocchi...`);
          try {
            await callOdoo('blog.post', 'update_field_translations', [
              [postId],
              'content',
              { [odooLang]: translations }
            ], {});
            console.log(`   ✅ Tradotto\n`);
          } catch (e: any) {
            console.log(`   ❌ Errore: ${e.message}\n`);
          }
        }
      }
    } else {
      console.log('⚠️  Nessun segmento trovato\n');
    }

  } catch (e: any) {
    console.log(`❌ Errore get_field_translations: ${e.message}\n`);
  }

  // 7. Verify
  console.log('⏳ Attendo 3 secondi...\n');
  await new Promise(r => setTimeout(r, 3000));

  console.log('📋 VERIFICA:\n');

  const languages = {
    'it_IT': 'Italiano 🇮🇹',
    'de_CH': 'Tedesco 🇩🇪',
    'fr_CH': 'Francese 🇫🇷',
    'en_US': 'Inglese 🇬🇧'
  };

  for (const [lang, langName] of Object.entries(languages)) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      const p = post[0];
      const textContent = p.content ? p.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'VUOTO';

      console.log(`${langName}:`);
      console.log(`   Titolo: ${p.name}`);
      console.log(`   Content: ${textContent.substring(0, 150)}...\n`);
    }
  }

  console.log('🎉 Test completato!');
}

main().catch(console.error);
