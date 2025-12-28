/**
 * Upload articoli usando update_field_translations - IL METODO CORRETTO!
 * Questo è come funziona Odoo per le traduzioni
 */

import { readFileSync, readdirSync } from 'fs';
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

async function uploadArticle(articlePath: string): Promise<number> {
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  // 1. Crea post in italiano
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

  // 2. Usa update_field_translations per impostare TUTTE le traduzioni correttamente
  // Formato corretto: [[record_id], 'field_name', {lang: value, lang: value}]

  // Content
  await callOdoo('blog.post', 'update_field_translations', [
    [postId],
    'content',
    {
      'it_IT': article.translations.it_IT.content_html,
      'de_CH': article.translations.de_DE.content_html,
      'fr_CH': article.translations.fr_FR.content_html,
      'en_US': article.translations.en_US.content_html
    }
  ], {});

  // Name (title)
  await callOdoo('blog.post', 'update_field_translations', [
    [postId],
    'name',
    {
      'it_IT': article.translations.it_IT.name,
      'de_CH': article.translations.de_DE.name,
      'fr_CH': article.translations.fr_FR.name,
      'en_US': article.translations.en_US.name
    }
  ], {});

  // Subtitle
  await callOdoo('blog.post', 'update_field_translations', [
    [postId],
    'subtitle',
    {
      'it_IT': article.translations.it_IT.subtitle,
      'de_CH': article.translations.de_DE.subtitle,
      'fr_CH': article.translations.fr_FR.subtitle,
      'en_US': article.translations.en_US.subtitle
    }
  ], {});

  // Meta title
  await callOdoo('blog.post', 'update_field_translations', [
    [postId],
    'website_meta_title',
    {
      'it_IT': article.translations.it_IT.meta.title,
      'de_CH': article.translations.de_DE.meta.title,
      'fr_CH': article.translations.fr_FR.meta.title,
      'en_US': article.translations.en_US.meta.title
    }
  ], {});

  // Meta description
  await callOdoo('blog.post', 'update_field_translations', [
    [postId],
    'website_meta_description',
    {
      'it_IT': article.translations.it_IT.meta.description,
      'de_CH': article.translations.de_DE.meta.description,
      'fr_CH': article.translations.fr_FR.meta.description,
      'en_US': article.translations.en_US.meta.description
    }
  ], {});

  // Meta keywords
  await callOdoo('blog.post', 'update_field_translations', [
    [postId],
    'website_meta_keywords',
    {
      'it_IT': article.translations.it_IT.meta.keywords,
      'de_CH': article.translations.de_DE.meta.keywords,
      'fr_CH': article.translations.fr_FR.meta.keywords,
      'en_US': article.translations.en_US.meta.keywords
    }
  ], {});

  return postId;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   UPLOAD ARTICOLI CON update_field_translations CORRETTO  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Test con solo articolo 1 prima
  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');

  console.log('📝 Test con articolo 1...\n');

  // Delete post 408 if exists
  try {
    await callOdoo('blog.post', 'unlink', [[408]], {});
    console.log('🗑️  Eliminato post 408\n');
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.log('⚠️  Post 408 non trovato\n');
  }

  const postId = await uploadArticle(articlePath);
  console.log(`✅ Creato post ID ${postId}\n`);

  console.log('⏳ Attendo 3 secondi per Odoo...\n');
  await new Promise(r => setTimeout(r, 3000));

  // Verifica
  console.log('📋 VERIFICA TRADUZIONI:\n');

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
