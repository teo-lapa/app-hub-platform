/**
 * Crea articolo partendo da italiano come lingua base
 * poi aggiunge le traduzioni usando il formato blocchi
 */

import { odoo } from '../src/connectors/odoo.js';
import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

// Helper per estrarre i blocchi di testo da HTML
function extractTextBlocks(html: string): string[] {
  const blocks: string[] = [];

  // Regex per estrarre contenuto da tag
  const patterns = [
    /<h1[^>]*>([^<]+)<\/h1>/g,
    /<h2[^>]*>([^<]+)<\/h2>/g,
    /<h3[^>]*>([^<]+)<\/h3>/g,
    /<p[^>]*>(.*?)<\/p>/gs,
    /<li[^>]*>(.*?)<\/li>/gs,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = match[1].trim();
      if (text && text.length > 0) {
        blocks.push(text);
      }
    }
  }

  return blocks;
}

async function createArticle() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  // Elimina articolo 116 se esiste
  console.log('🗑️ Elimino articolo 116...');
  try {
    await odoo['execute']<boolean>('blog.post', 'unlink', [[116]]);
    console.log('   Eliminato');
  } catch (e) {
    console.log('   Non esisteva');
  }

  // Crea articolo in italiano
  console.log('\n🇮🇹 Creo articolo in ITALIANO...');
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

  console.log(`   Creato ID: ${postId}`);

  // Verifica blocchi creati
  console.log('\n📖 Leggo blocchi creati...');
  const translations = await odoo['execute']<any>(
    'blog.post',
    'get_field_translations',
    [[postId], 'content'],
    {}
  );

  // Estrai sources unici (in italiano)
  const sources = [...new Set(translations[0].map((t: any) => t.source))];
  console.log(`   ${sources.length} blocchi unici in italiano`);

  // Ora devo creare il mapping tra blocchi italiani e traduzioni
  const itBlocks = extractTextBlocks(itData.content_html);
  const deBlocks = extractTextBlocks(article.translations.de_DE.content_html);
  const frBlocks = extractTextBlocks(article.translations.fr_FR.content_html);
  const enBlocks = extractTextBlocks(article.translations.en_US.content_html);

  console.log(`\n📊 Blocchi estratti:`);
  console.log(`   IT: ${itBlocks.length}`);
  console.log(`   DE: ${deBlocks.length}`);
  console.log(`   FR: ${frBlocks.length}`);
  console.log(`   EN: ${enBlocks.length}`);

  // Mostra primi 3 blocchi per confronto
  console.log('\nPrimi 3 blocchi:');
  for (let i = 0; i < 3 && i < itBlocks.length; i++) {
    console.log(`\n${i + 1}. IT: "${itBlocks[i].substring(0, 60)}..."`);
    console.log(`   DE: "${deBlocks[i]?.substring(0, 60) || 'MANCA'}..."`);
  }

  // Se i blocchi corrispondono, creo il mapping
  if (itBlocks.length === deBlocks.length && itBlocks.length === frBlocks.length) {
    console.log('\n✅ I blocchi corrispondono! Creo mapping traduzioni...');

    // Prepara le traduzioni nel formato {source: {lang: value}}
    const translationMap: Record<string, Record<string, string>> = {};

    for (let i = 0; i < itBlocks.length; i++) {
      const src = itBlocks[i];
      translationMap[src] = {
        'de_CH': deBlocks[i],
        'fr_CH': frBlocks[i],
        'en_US': enBlocks[i],
      };
    }

    console.log(`   Mappate ${Object.keys(translationMap).length} traduzioni`);

    // Prova update_field_translations
    console.log('\n📝 Applico traduzioni...');
    try {
      const result = await odoo['execute']<any>(
        'blog.post',
        'update_field_translations',
        [[postId], 'content', translationMap],
        {}
      );
      console.log('   Risultato:', result);
    } catch (e: any) {
      console.log('   Errore:', e.message.split('\n').slice(-2).join(' '));
    }
  } else {
    console.log('\n⚠️ I blocchi NON corrispondono - serve mapping manuale');
  }

  console.log(`\n📌 Articolo creato con ID: ${postId}`);
}

createArticle().catch(console.error);
