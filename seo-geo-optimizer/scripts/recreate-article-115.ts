/**
 * Ricrea l'articolo 115 con le traduzioni corrette
 *
 * Strategia:
 * 1. Elimina articolo 115
 * 2. Crea nuovo articolo in italiano
 * 3. Aggiungi traduzioni con update_field_translations
 */

import { odoo } from '../src/connectors/odoo.js';
import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

async function recreate() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  // 1. Elimina articolo 115
  console.log('🗑️ Eliminazione articolo 115...');
  try {
    await odoo['execute']<boolean>('blog.post', 'unlink', [[115]]);
    console.log('   Articolo eliminato');
  } catch (e: any) {
    console.log('   Articolo non trovato o già eliminato');
  }

  // 2. Crea in italiano (lingua base di Odoo di solito)
  console.log('\n🇮🇹 Creazione articolo in ITALIANO...');
  const itData = article.translations.it_IT;

  const postId = await odoo.createBlogPost({
    name: itData.name,
    subtitle: itData.subtitle,
    content: itData.content_html,
    blog_id: 4, // LAPABlog
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    is_published: false
  }, 'it_IT');

  console.log(`   Creato con ID: ${postId}`);

  // 3. Verifica che italiano sia salvato
  console.log('\n🔍 Verifica contenuto italiano...');
  const itCheck = await odoo['execute']<any[]>(
    'blog.post', 'read', [[postId]],
    { fields: ['name', 'content'], context: { lang: 'it_IT' } }
  );
  const itH1 = itCheck[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
  console.log(`   H1 IT: ${itH1}`);

  // 4. Ora aggiungi le traduzioni
  const translations = [
    { lang: 'de_CH', data: article.translations.de_DE, flag: '🇩🇪🇨🇭' },
    { lang: 'fr_CH', data: article.translations.fr_FR, flag: '🇫🇷🇨🇭' },
    { lang: 'en_US', data: article.translations.en_US, flag: '🇺🇸' },
  ];

  for (const { lang, data, flag } of translations) {
    console.log(`\n${flag} Aggiunta traduzione ${lang}...`);

    // Usa write con context lang
    await odoo['execute']<boolean>(
      'blog.post',
      'write',
      [[postId], {
        name: data.name,
        subtitle: data.subtitle,
        content: data.content_html,
        website_meta_title: data.meta.title,
        website_meta_description: data.meta.description,
        website_meta_keywords: data.meta.keywords
      }],
      { context: { lang } }
    );
    console.log(`   Write completato`);

    // Verifica
    const check = await odoo['execute']<any[]>(
      'blog.post', 'read', [[postId]],
      { fields: ['name', 'content'], context: { lang } }
    );
    const h1 = check[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
    console.log(`   Verifica H1: ${h1?.substring(0, 50)}...`);
  }

  // 5. Verifica finale tutte le lingue
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICA FINALE');
  console.log('='.repeat(60));

  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const result = await odoo['execute']<any[]>(
      'blog.post', 'read', [[postId]],
      { fields: ['name', 'content'], context: { lang } }
    );
    const name = result[0]?.name;
    const h1 = result[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
    console.log(`\n${lang}:`);
    console.log(`  Nome: ${name}`);
    console.log(`  H1: ${h1}`);
  }

  console.log(`\n\n✅ Articolo ricreato con ID: ${postId}`);
}

recreate().catch(console.error);
