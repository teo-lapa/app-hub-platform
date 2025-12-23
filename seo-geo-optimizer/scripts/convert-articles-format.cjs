/**
 * Converti i 27 articoli generati nel formato compatibile con upload-all-articles.ts
 */

const fs = require('fs');
const path = require('path');

// Funzione per convertire Markdown in HTML
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
  html = html.replace(/^✅ (.*$)/gim, '<li>✅ $1</li>');
  html = html.replace(/^❌ (.*$)/gim, '<li>❌ $1</li>');
  html = html.replace(/^🍷 (.*$)/gim, '<li>🍷 $1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // Wrap <li> in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Tables
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

  // Wrap in Odoo section
  return `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">

${html}

</div>
</section>`;
}

async function main() {
  console.log('🔄 CONVERSIONE 27 ARTICOLI NEL FORMATO CORRETTO\n');

  const inputDir = path.join(__dirname, '../output/articles');
  const outputDir = path.join(__dirname, '../data/new-articles');

  const files = fs.readdirSync(inputDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`📄 Articoli da convertire: ${files.length}\n`);

  let converted = 0;

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const article = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    // Crea nuovo formato
    const newArticle = {
      article_id: article.article_id,
      topic: article.translations.it_IT.title,
      translations: {}
    };

    // Converti ogni lingua
    for (const [langKey, langData] of Object.entries(article.translations)) {
      newArticle.translations[langKey] = {
        name: langData.title,
        subtitle: langData.subtitle,
        meta: {
          title: langData.meta_title,
          description: langData.meta_description,
          keywords: langData.keywords.join(', ')
        },
        content_html: markdownToHtml(langData.content)
      };
    }

    // Salva con nome formato article-XX
    const outputFile = `article-${file}`;
    const outputPath = path.join(outputDir, outputFile);

    fs.writeFileSync(outputPath, JSON.stringify(newArticle, null, 2));

    console.log(`✓ ${file} → ${outputFile}`);
    converted++;
  }

  console.log(`\n✅ Convertiti ${converted}/${files.length} articoli!`);
  console.log(`📂 Salvati in: ${outputDir}\n`);
}

main().catch(console.error);
