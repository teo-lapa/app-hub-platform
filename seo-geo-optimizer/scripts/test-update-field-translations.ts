/**
 * Test update_field_translations con la sintassi corretta
 * Questo metodo in Odoo 17 richiede: (self, field_name, translations)
 * dove translations è un dict {lang: {id: value}}
 */

import { odoo } from '../src/connectors/odoo.js';
import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

async function test() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  const postId = 116;

  // Sintassi corretta: update_field_translations(field_name, translations)
  // translations = {lang: {record_id: value}}
  console.log('📝 Test update_field_translations con sintassi corretta...');

  try {
    // Formato: {lang: {id: value}}
    const translations = {
      'it_IT': { [postId]: article.translations.it_IT.content_html },
      'de_CH': { [postId]: article.translations.de_DE.content_html },
      'fr_CH': { [postId]: article.translations.fr_FR.content_html },
      'en_US': { [postId]: article.translations.en_US.content_html },
    };

    const result = await odoo['execute']<any>(
      'blog.post',
      'update_field_translations',
      ['content', translations],
      {}
    );
    console.log('   Risultato:', result);
  } catch (e: any) {
    console.log('   Errore:', e.message.split('\n').slice(0, 5).join('\n'));
  }

  // Prova anche con array invece di singolo record
  console.log('\n📝 Test con sintassi array...');
  try {
    const result = await odoo['execute']<any>(
      'blog.post',
      'update_field_translations',
      [[postId], 'content', {
        'it_IT': article.translations.it_IT.content_html,
        'de_CH': article.translations.de_DE.content_html,
        'fr_CH': article.translations.fr_FR.content_html,
        'en_US': article.translations.en_US.content_html,
      }],
      {}
    );
    console.log('   Risultato:', result);
  } catch (e: any) {
    console.log('   Errore:', e.message.split('\n').slice(-3).join('\n'));
  }

  // Prova con browse prima
  console.log('\n📝 Test chiamando prima browse...');
  try {
    // In Odoo, prima devi fare browse per ottenere il recordset
    // poi chiamare update_field_translations su quello
    // Ma via XML-RPC non funziona così...

    // Prova sintassi alternativa
    const result = await odoo['execute']<any>(
      'blog.post',
      'browse',
      [[postId]],
      {}
    );
    console.log('   browse result:', result);
  } catch (e: any) {
    console.log('   Errore:', e.message.split('\n').slice(-2).join('\n'));
  }

  // Ultima prova: usare write_vals
  console.log('\n📝 Test con metodo generico...');
  try {
    // Verifica quali metodi sono disponibili
    const methods = await odoo['execute']<any>(
      'blog.post',
      'fields_get',
      [],
      { attributes: ['string'] }
    );

    // Cerca metodi relativi alle traduzioni
    console.log('   Campi disponibili con "translat" nel nome:');
    for (const [name, _] of Object.entries(methods)) {
      if (name.toLowerCase().includes('translat')) {
        console.log(`     - ${name}`);
      }
    }
  } catch (e: any) {
    console.log('   Errore:', e.message.substring(0, 200));
  }
}

test().catch(console.error);
