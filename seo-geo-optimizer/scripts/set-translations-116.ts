/**
 * Setta le traduzioni a blocchi per l'articolo 116
 * usando update_field_translations
 */

import { odoo } from '../src/connectors/odoo.js';
import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

async function setTranslations() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  const postId = 116;

  // Prima leggo le traduzioni attuali per vedere la struttura
  console.log('📖 Leggo traduzioni attuali...');
  const currentTranslations = await odoo['execute']<any>(
    'blog.post',
    'get_field_translations',
    [[postId], 'content'],
    {}
  );

  console.log(`Trovati ${currentTranslations[0].length} blocchi da tradurre`);
  console.log('Primi 3 blocchi:');
  currentTranslations[0].slice(0, 3).forEach((t: any, i: number) => {
    console.log(`  ${i}: [${t.lang}] "${t.source.substring(0, 50)}..." -> "${t.value || '(vuoto)'}"`);
  });

  // Ora devo capire come passare le traduzioni
  // Il formato sembra essere: {lang: {source: value}}
  // Oppure uso update_field_translations con formato diverso

  console.log('\n📝 Provo update_field_translations...');

  // Preparo le traduzioni nel formato {source: {lang: value}}
  // oppure {lang: {source: value}}

  // Estraggo i blocchi unici dal source (sono in tedesco attualmente)
  const uniqueSources = [...new Set(currentTranslations[0].map((t: any) => t.source))];
  console.log(`Blocchi unici: ${uniqueSources.length}`);

  // Per ora provo con un formato semplice
  try {
    // Formato: update_field_translations(field_name, {lang: value_or_dict})
    // Ma forse devo passare direttamente il contenuto per lingua

    const result = await odoo['execute']<any>(
      'blog.post',
      'update_field_translations',
      ['content', {
        'it_IT': article.translations.it_IT.content_html,
        'de_CH': article.translations.de_DE.content_html,
        'fr_CH': article.translations.fr_FR.content_html,
        'en_US': article.translations.en_US.content_html,
      }],
      {}
    );
    console.log('Risultato:', result);
  } catch (e: any) {
    console.log('Errore formato 1:', e.message.split('\n').slice(-3).join(' '));
  }

  // Provo formato alternativo con record id
  console.log('\n📝 Provo formato con ID...');
  try {
    const result = await odoo['execute']<any>(
      'blog.post',
      'update_field_translations',
      [[postId], 'content', {
        'it_IT': article.translations.it_IT.content_html,
      }],
      {}
    );
    console.log('Risultato:', result);
  } catch (e: any) {
    console.log('Errore formato 2:', e.message.split('\n').slice(-3).join(' '));
  }
}

setTranslations().catch(console.error);
