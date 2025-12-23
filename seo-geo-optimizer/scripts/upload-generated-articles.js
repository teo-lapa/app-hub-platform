/**
 * Upload articoli generati (JSON con markdown) su Odoo
 * Con traduzioni complete e ottimizzazione SEO/GEO
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
 * Converti Markdown in HTML
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

  // Lists
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^✅ (.*$)/gim, '<li>✅ $1</li>');
  html = html.replace(/^❌ (.*$)/gim, '<li>❌ $1</li>');
  html = html.replace(/^🍷 (.*$)/gim, '<li>🍷 $1</li>');
  html = html.replace(/^🛡️ (.*$)/gim, '<li>🛡️ $1</li>');
  html = html.replace(/^👉 (.*$)/gim, '<li>👉 $1</li>');
  html = html.replace(/^📧 (.*$)/gim, '<li>📧 $1</li>');
  html = html.replace(/^📞 (.*$)/gim, '<li>📞 $1</li>');
  html = html.replace(/^🌐 (.*$)/gim, '<li>🌐 $1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Tables (convert markdown tables to HTML)
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, header, rows) => {
    const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
    const rowsHtml = rows.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    return `<table border="1" style="border-collapse: collapse; width: 100%; margin: 20px 0;">
<thead><tr>${headers}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>`;
  });

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up
  html = html.replace(/<p><h/g, '<h');
  html = html.replace(/<\/h([1-6])><\/p>/g, '</h$1>');
  html = html.replace(/<p><ul>/g, '<ul>');
  html = html.replace(/<\/ul><\/p>/g, '</ul>');
  html = html.replace(/<p><table/g, '<table');
  html = html.replace(/<\/table><\/p>/g, '</table>');
  html = html.replace(/<p>\s*<\/p>/g, '');

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
  if (!data.result?.uid) throw new Error('Auth failed');
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

async function uploadArticle(articlePath) {
  const article = JSON.parse(fs.readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log(`  📝 Titolo: ${itData.title}`);
  console.log(`  📊 Lunghezza: ${itData.content.split(/\s+/).length} parole`);

  // Converti markdown in HTML
  const itContentHtml = markdownToHtml(itData.content);

  // 1. Crea articolo in italiano
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

  console.log(`  ✅ Creato ID: ${postId}`);

  // 2. Traduci per ogni lingua
  for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
    if (jsonLang === 'it_IT') continue;
    const langData = article.translations[jsonLang];
    if (!langData) continue;

    const langContentHtml = markdownToHtml(langData.content);

    console.log(`  🌐 Traduzione ${jsonLang}...`);

    await callOdoo('blog.post', 'write', [[postId], {
      name: langData.title,
      subtitle: langData.subtitle,
      content: langContentHtml,
      website_meta_title: langData.meta_title,
      website_meta_description: langData.meta_description,
      website_meta_keywords: langData.keywords.join(', ')
    }], { context: { lang: odooLang } });
  }

  return postId;
}

async function main() {
  console.log('🚀 UPLOAD ARTICOLI GENERATI SU ODOO\n');
  console.log('═'.repeat(60));

  // Authenticate
  console.log('\n🔐 Autenticazione Odoo...');
  await authenticate();
  console.log('✅ Autenticato\n');

  // Find all articles
  const articlesDir = path.join(__dirname, '../output/articles');
  const files = fs.readdirSync(articlesDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`📄 Trovati ${files.length} articoli da caricare\n`);
  console.log('═'.repeat(60));

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
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(`  ❌ ERRORE: ${e.message.substring(0, 150)}`);
      errors.push({ file, error: e.message });
    }
  }

  // Riepilogo
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RIEPILOGO UPLOAD');
  console.log('═'.repeat(60) + '\n');

  console.log(`✅ Successi: ${results.length}/${files.length}`);
  console.log(`❌ Errori: ${errors.length}/${files.length}\n`);

  if (results.length > 0) {
    console.log('✅ ARTICOLI CARICATI:\n');
    for (const r of results) {
      console.log(`  • ${r.file}`);
      console.log(`    ID: ${r.postId}`);
      console.log(`    URL: ${ODOO_URL}/blog/lapablog-4/${r.postId}`);
      console.log(`    Titolo: "${r.title.substring(0, 50)}..."\n`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ ERRORI:\n');
    for (const e of errors) {
      console.log(`  • ${e.file}: ${e.error.substring(0, 100)}`);
    }
  }

  console.log('\n🎉 Upload completato!');
  console.log('\n⚠️  IMPORTANTE: Gli articoli sono in BOZZA.');
  console.log('   Revisiona e pubblica manualmente da Odoo.\n');
}

main().catch(console.error);
