/**
 * UPLOAD 27 ARTICOLI GENERATI SU ODOO
 * Con traduzioni complete usando il sistema di blocchi Odoo
 */

const fs = require('fs');
const path = require('path');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

const LANG_MAP = {
  'it_IT': 'it_IT',
  'de_DE': 'de_CH',
  'fr_FR': 'fr_CH',
  'en_US': 'en_US'
};

/**
 * Converti Markdown in HTML con formattazione Odoo
 */
function markdownToHtml(md) {
  let html = md;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  // Lists - Emoji lists
  html = html.replace(/^✅ (.*$)/gim, '<li class="check">✅ $1</li>');
  html = html.replace(/^❌ (.*$)/gim, '<li class="cross">❌ $1</li>');
  html = html.replace(/^🍷 (.*$)/gim, '<li class="wine">🍷 $1</li>');
  html = html.replace(/^🛡️ (.*$)/gim, '<li class="shield">🛡️ $1</li>');
  html = html.replace(/^👉 (.*$)/gim, '<li class="point">👉 $1</li>');

  // Regular lists
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Tables (convert markdown tables to HTML)
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, header, rows) => {
    const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
    const rowsHtml = rows.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    return `<table class="table table-bordered" style="width: 100%; margin: 20px 0;">
<thead><tr>${headers}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>`;
  });

  // Paragraphs
  html = html.replace(/\n\n/g, '</p>\n<p>');
  html = '<p>' + html + '</p>';

  // Clean up
  html = html.replace(/<p><h/g, '<h');
  html = html.replace(/<\/h([1-6])><\/p>/g, '</h$1>');
  html = html.replace(/<p><ul>/g, '<ul>');
  html = html.replace(/<\/ul><\/p>/g, '</ul>');
  html = html.replace(/<p><table/g, '<table');
  html = html.replace(/<\/table><\/p>/g, '</table>');
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p><div/g, '<div');
  html = html.replace(/<\/div><\/p>/g, '</div>');

  // Wrap in main container
  html = `<div class="blog-content">\n${html}\n</div>`;

  return html;
}

async function authenticate() {
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
  if (!data.result || !data.result.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model, method, args, kwargs = {}) {
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
 * Estrai testi da HTML per matching traduzioni
 */
function extractTexts(html) {
  const texts = [];
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

async function uploadArticle(articlePath) {
  const article = JSON.parse(fs.readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log(`  📝 ${itData.title}`);
  console.log(`  📊 ${itData.content.split(/\s+/).length} parole`);

  // Converti markdown in HTML
  const itContentHtml = markdownToHtml(itData.content);

  // 1. Crea articolo in italiano (base)
  console.log(`  📤 Creazione articolo...`);
  const postId = await callOdoo('blog.post', 'create', [{
    name: itData.title,
    subtitle: itData.subtitle,
    content: itContentHtml,
    blog_id: 4,
    website_meta_title: itData.meta_title,
    website_meta_description: itData.meta_description,
    website_meta_keywords: itData.keywords.join(', '),
    is_published: false  // Draft per revisione
  }], { context: { lang: 'it_IT' } });

  console.log(`  ✅ ID: ${postId}`);

  // 2. Traduci name, subtitle, meta per ogni lingua
  console.log(`  🌐 Traduzioni meta...`);
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) {
      console.log(`     ⚠️  ${jsonLang}: mancante`);
      continue;
    }

    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.title,
      subtitle: langData.subtitle,
      website_meta_title: langData.meta_title,
      website_meta_description: langData.meta_description,
      website_meta_keywords: langData.keywords.join(', ')
    }], { context: { lang: odooLang } });

    console.log(`     ✓ ${jsonLang}`);
  }

  // 3. Traduci content con sistema blocchi
  console.log(`  📝 Traduzioni content...`);

  // Aspetta un po' per permettere a Odoo di processare
  await new Promise(r => setTimeout(r, 2000));

  // Ottieni i blocchi di traduzione generati da Odoo
  const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});

  if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
    const segments = fieldTrans[0];

    // Raggruppa per source (testo originale italiano)
    const sourceTexts = [...new Set(segments.map(s => s.source))];
    console.log(`     Blocchi: ${sourceTexts.length}`);

    // Estrai testi dalle versioni HTML tradotte
    const itTexts = extractTexts(itContentHtml);

    for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
      if (jsonLang === 'it_IT') continue;
      const langData = article.translations[jsonLang];
      if (!langData) continue;

      const langContentHtml = markdownToHtml(langData.content);
      const langTexts = extractTexts(langContentHtml);

      // Crea mapping source -> traduzione
      const translations = {};

      for (const srcText of sourceTexts) {
        const itIdx = itTexts.indexOf(srcText);
        if (itIdx >= 0 && langTexts[itIdx]) {
          translations[srcText] = langTexts[itIdx];
        }
      }

      if (Object.keys(translations).length > 0) {
        try {
          await callOdoo('blog.post', 'update_field_translations', [
            [postId],
            'content',
            { [odooLang]: translations }
          ]);
          console.log(`     ✓ ${jsonLang}: ${Object.keys(translations).length} blocchi`);
        } catch (e) {
          console.log(`     ⚠️  ${jsonLang}: errore traduzione`);
        }
      }
    }
  } else {
    console.log(`     ⚠️  Nessun blocco trovato`);
  }

  return postId;
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 UPLOAD 27 ARTICOLI BLOG LAPA SU ODOO');
  console.log('═'.repeat(70) + '\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ Autenticato\n');

  // Trova articoli
  const articlesDir = path.join(__dirname, '../output/articles');
  const files = fs.readdirSync(articlesDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`📄 Articoli da caricare: ${files.length}\n`);
  console.log('═'.repeat(70));

  const results = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}] ${file}`);

    try {
      const articlePath = path.join(articlesDir, file);
      const postId = await uploadArticle(articlePath);

      const article = JSON.parse(fs.readFileSync(articlePath, 'utf-8'));
      results.push({
        file,
        postId,
        title: article.translations.it_IT.title
      });

      // Pausa tra articoli
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.log(`  ❌ ERRORE: ${e.message.substring(0, 200)}`);
      errors.push({ file, error: e.message });
    }
  }

  // Riepilogo finale
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RIEPILOGO UPLOAD');
  console.log('═'.repeat(70) + '\n');

  console.log(`✅ Successi: ${results.length}/${files.length}`);
  console.log(`❌ Errori: ${errors.length}/${files.length}\n`);

  if (results.length > 0) {
    console.log('✅ ARTICOLI PUBBLICATI:\n');
    for (const r of results) {
      console.log(`${r.postId}. ${r.title.substring(0, 60)}...`);
      console.log(`   File: ${r.file}`);
      console.log(`   URL: ${ODOO_URL}/blog/lapablog-4/${r.postId}\n`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ ERRORI:\n');
    for (const e of errors) {
      console.log(`• ${e.file}`);
      console.log(`  ${e.error.substring(0, 150)}\n`);
    }
  }

  console.log('═'.repeat(70));
  console.log('🎉 Upload completato!');
  console.log('\n⚠️  IMPORTANTE: Gli articoli sono in BOZZA (non pubblicati).');
  console.log('   Revisiona e pubblica manualmente da Odoo Backend.\n');
  console.log('═'.repeat(70) + '\n');
}

main().catch(console.error);
