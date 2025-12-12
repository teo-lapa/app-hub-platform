/**
 * Test diversi metodi per tradurre il campo content
 */

import { odoo } from '../src/connectors/odoo.js';
import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

async function test() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  const postId = 116;

  // Metodo 1: Prova update_field_translations (Odoo 17+)
  console.log('📝 Metodo 1: update_field_translations...');
  try {
    const result = await odoo['execute']<any>(
      'blog.post',
      'update_field_translations',
      ['content', {
        'it_IT': article.translations.it_IT.content_html,
        'de_CH': article.translations.de_DE.content_html,
        'fr_CH': article.translations.fr_FR.content_html,
        'en_US': article.translations.en_US.content_html,
      }],
      { context: {} }
    );
    console.log('   Risultato:', result);
  } catch (e: any) {
    console.log('   Errore:', e.message);
  }

  // Metodo 2: Prova con with_context (se disponibile)
  console.log('\n📝 Metodo 2: with_context...');
  try {
    // Prima italiano
    await odoo['execute']<boolean>(
      'blog.post', 'with_context', [{ lang: 'it_IT' }],
      {}
    );
  } catch (e: any) {
    console.log('   with_context non disponibile:', e.message.substring(0, 100));
  }

  // Metodo 3: Prova a forzare la traduzione scrivendo ogni lingua separatamente
  // con un delay tra una e l'altra
  console.log('\n📝 Metodo 3: Write sequenziale con delay...');

  const translations = [
    { lang: 'it_IT', data: article.translations.it_IT },
    { lang: 'de_CH', data: article.translations.de_DE },
    { lang: 'fr_CH', data: article.translations.fr_FR },
    { lang: 'en_US', data: article.translations.en_US },
  ];

  // Prima leggiamo il record originale per vedere la struttura
  console.log('   Lettura record originale...');
  const original = await odoo['execute']<any[]>(
    'blog.post', 'read', [[postId]],
    { fields: ['content'] }
  );
  console.log('   Tipo content:', typeof original[0]?.content);
  console.log('   Content length:', original[0]?.content?.length);

  // Prova: cambia solo il content per una lingua specifica
  console.log('\n📝 Metodo 4: Solo update content per IT...');
  await odoo['execute']<boolean>(
    'blog.post', 'write', [[postId], {
      content: article.translations.it_IT.content_html
    }],
    { context: { lang: 'it_IT' } }
  );

  // Verifica immediata
  const itCheck = await odoo['execute']<any[]>(
    'blog.post', 'read', [[postId]],
    { fields: ['content'], context: { lang: 'it_IT' } }
  );
  const itH1 = itCheck[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
  console.log('   IT H1 dopo write:', itH1);

  // Verifica altra lingua PRIMA di modificarla
  const deCheckBefore = await odoo['execute']<any[]>(
    'blog.post', 'read', [[postId]],
    { fields: ['content'], context: { lang: 'de_CH' } }
  );
  const deH1Before = deCheckBefore[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
  console.log('   DE H1 PRIMA di write DE:', deH1Before);

  // Ora scrivi DE
  console.log('\n📝 Write content per DE...');
  await odoo['execute']<boolean>(
    'blog.post', 'write', [[postId], {
      content: article.translations.de_DE.content_html
    }],
    { context: { lang: 'de_CH' } }
  );

  // Verifica dopo
  const deCheckAfter = await odoo['execute']<any[]>(
    'blog.post', 'read', [[postId]],
    { fields: ['content'], context: { lang: 'de_CH' } }
  );
  const deH1After = deCheckAfter[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
  console.log('   DE H1 DOPO write DE:', deH1After);

  // Verifica che IT sia ancora IT
  const itCheckAfterDe = await odoo['execute']<any[]>(
    'blog.post', 'read', [[postId]],
    { fields: ['content'], context: { lang: 'it_IT' } }
  );
  const itH1AfterDe = itCheckAfterDe[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
  console.log('   IT H1 dopo write DE (dovrebbe essere ancora IT):', itH1AfterDe);
}

test().catch(console.error);
