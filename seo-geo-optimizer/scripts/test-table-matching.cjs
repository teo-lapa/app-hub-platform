/**
 * Test per capire come matchare le celle di tabella
 */

const fs = require('fs');

const article = JSON.parse(fs.readFileSync('data/new-articles/article-02-burrata-andria-dop.json', 'utf-8'));

const itHtml = article.translations.it_IT.content_html;
const deHtml = article.translations.de_DE.content_html;

console.log('🔍 ANALISI TABELLE\n');

// Estrai tutte le tabelle
const itTables = itHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
const deTables = deHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];

console.log(`Tabelle IT: ${itTables.length}`);
console.log(`Tabelle DE: ${deTables.length}\n`);

if (itTables.length > 0) {
  console.log('PRIMA TABELLA ITALIANA:');
  console.log(itTables[0].substring(0, 500) + '...\n');

  console.log('PRIMA TABELLA TEDESCA:');
  console.log(deTables[0].substring(0, 500) + '...\n');

  // Estrai celle dalla prima tabella
  function extractCells(table) {
    const cells = [];
    const cellRegex = /<t[hd][^>]*>([^<]*)<\/t[hd]>/gi;
    let match;
    while ((match = cellRegex.exec(table)) !== null) {
      cells.push(match[1].trim());
    }
    return cells;
  }

  const itCells = extractCells(itTables[0]);
  const deCells = extractCells(deTables[0]);

  console.log('\nCELLE TABELLA 1:');
  console.log(`IT (${itCells.length}):`, itCells.slice(0, 10));
  console.log(`DE (${deCells.length}):`, deCells.slice(0, 10));

  // Cerca "Parametro" nelle celle IT
  const paramIdx = itCells.indexOf('Parametro');
  console.log(`\n"Parametro" è alla posizione: ${paramIdx}`);
  if (paramIdx >= 0 && paramIdx < deCells.length) {
    console.log(`Corrispondente in DE: "${deCells[paramIdx]}"`);
  }
}

