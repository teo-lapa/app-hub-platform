/**
 * Test extraction on German JSON
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function extractAllTexts(html: string): string[] {
  const texts: string[] = [];

  // Remove scripts and styles
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove all HTML tags but keep the text
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Split by multiple spaces/newlines and clean up
  const lines = cleaned.split(/\s{2,}|\n+/);

  for (const line of lines) {
    const trimmed = line.trim().replace(/\s+/g, ' ');
    if (trimmed && trimmed.length > 0 && !/^[\s\n\r]*$/.test(trimmed)) {
      texts.push(trimmed);
    }
  }

  return texts;
}

const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');
const article = JSON.parse(readFileSync(articlePath, 'utf-8'));

const itHtml = article.translations.it_IT.content_html;
const deHtml = article.translations.de_DE.content_html;

console.log('📋 TEST ESTRAZIONE ITALIANO:\n');
const itTexts = extractAllTexts(itHtml);
console.log(`Totale testi: ${itTexts.length}\n`);

// Find texts related to the list
const listTexts = itTexts.filter(t =>
  t.includes('Tirarlo fuori') ||
  t.includes('Tagliarlo') ||
  t.includes('Metterlo') ||
  t.includes('Far scolare') ||
  t.includes('Tamponare')
);

console.log('Testi della lista:\n');
listTexts.forEach((t, i) => {
  console.log(`${i + 1}. ${t}`);
});

console.log('\n\n📋 TEST ESTRAZIONE TEDESCO:\n');
const deTexts = extractAllTexts(deHtml);
console.log(`Totale testi: ${deTexts.length}\n`);

// Find texts related to the list
const deListTexts = deTexts.filter(t =>
  t.includes('Aus der Flüssigkeit') ||
  t.includes('In Scheiben') ||
  t.includes('In ein Sieb') ||
  t.includes('Abtropfen') ||
  t.includes('Mit Küchenpapier')
);

console.log('Testi della lista:\n');
deListTexts.forEach((t, i) => {
  console.log(`${i + 1}. ${t}`);
});

// Check for the problematic text
const problematicCount = deTexts.filter(t => t.includes('Neapolitanischer Fior di Latte hat einen')).length;
console.log(`\n⚠️  "Neapolitanischer Fior di Latte hat einen" appare ${problematicCount} volte nell'estrazione\n`);
