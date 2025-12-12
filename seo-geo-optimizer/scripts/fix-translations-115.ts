/**
 * Script per forzare le traduzioni del contenuto HTML dell'articolo 115
 * Usando ir.translation direttamente
 */

import { odoo } from '../src/connectors/odoo.js';
import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

async function fixTranslations() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  const translations = [
    { lang: 'it_IT', data: article.translations.it_IT },
    { lang: 'de_CH', data: article.translations.de_DE },
    { lang: 'fr_CH', data: article.translations.fr_FR },
    { lang: 'en_US', data: article.translations.en_US },
  ];

  for (const { lang, data } of translations) {
    console.log(`\n📝 Aggiornamento contenuto per ${lang}...`);

    // Usa write con context lang per aggiornare il contenuto
    const result = await odoo['execute']<boolean>(
      'blog.post',
      'write',
      [[115], {
        content: data.content_html
      }],
      { context: { lang } }
    );

    console.log(`   Risultato write: ${result}`);
  }

  console.log('\n✅ Traduzioni contenuto aggiornate!');
  console.log('\nVerifica...');

  // Verifica
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const result = await odoo['execute']<any[]>(
      'blog.post',
      'read',
      [[115]],
      {
        fields: ['name', 'content'],
        context: { lang }
      }
    );
    const content = result[0]?.content || '';
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/);
    console.log(`${lang}: H1 = "${h1Match ? h1Match[1] : 'NON TROVATO'}"`);
  }
}

fixTranslations().catch(console.error);
