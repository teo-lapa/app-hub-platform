/**
 * Script per caricare un articolo su Odoo in tutte le lingue
 * Usage: npx tsx scripts/upload-article.ts <article-file.json>
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { odoo } from '../src/connectors/odoo.js';

interface ArticleTranslation {
  name: string;
  subtitle: string;
  meta: {
    title: string;
    description: string;
    keywords: string;
  };
  content_html: string;
}

interface ArticleData {
  article_id: string;
  topic: string;
  translations: {
    it_IT: ArticleTranslation;
    de_DE: ArticleTranslation;
    fr_FR: ArticleTranslation;
    en_US: ArticleTranslation;
  };
}

// Mappa lingue del file JSON -> codici Odoo (Svizzera usa de_CH e fr_CH)
const LANG_MAP: Record<string, string> = {
  'it_IT': 'it_IT',
  'de_DE': 'de_CH',  // Tedesco svizzero
  'fr_FR': 'fr_CH',  // Francese svizzero
  'en_US': 'en_US'
};

async function uploadArticle(articlePath: string) {
  console.log('📄 Caricamento articolo:', articlePath);

  // Leggi il file JSON
  const fullPath = resolve(articlePath);
  const articleJson = readFileSync(fullPath, 'utf-8');
  const article: ArticleData = JSON.parse(articleJson);

  console.log('📝 Articolo:', article.topic);
  console.log('🆔 ID:', article.article_id);

  // Test connessione
  console.log('\n🔌 Test connessione Odoo...');
  const connTest = await odoo.testConnection();
  if (!connTest.success) {
    throw new Error(`Connessione fallita: ${connTest.message}`);
  }
  console.log('✅ Connesso a Odoo');

  // Recupera i blog disponibili
  console.log('\n📚 Recupero blog disponibili...');
  const blogs = await odoo.getBlogs();
  console.log('Blog trovati:', blogs.map(b => `${b.id}: ${b.name}`).join(', '));

  if (blogs.length === 0) {
    throw new Error('Nessun blog trovato su Odoo');
  }

  // Cerca il blog "LAPABlog" o usa il primo disponibile
  const lapaBlog = blogs.find(b => b.name.toLowerCase().includes('lapablog'));
  const blogId = lapaBlog ? lapaBlog.id : blogs[0].id;
  const blogName = lapaBlog ? lapaBlog.name : blogs[0].name;
  console.log(`📌 Uso blog ID: ${blogId} (${blogName})`);

  // Recupera le lingue installate
  console.log('\n🌐 Recupero lingue installate...');
  const installedLangs = await odoo.getInstalledLanguages();
  console.log('Lingue installate:', installedLangs.map(l => l.code).join(', '));

  // Prima creiamo l'articolo in italiano (lingua base)
  console.log('\n🇮🇹 Creazione articolo in Italiano...');
  const itData = article.translations.it_IT;

  const postId = await odoo.createBlogPost({
    name: itData.name,
    subtitle: itData.subtitle,
    content: itData.content_html,
    blog_id: blogId,
    website_meta_title: itData.meta.title,
    website_meta_description: itData.meta.description,
    website_meta_keywords: itData.meta.keywords,
    is_published: false // Non pubblicare subito, prima verifichiamo
  }, 'it_IT');

  console.log(`✅ Articolo creato con ID: ${postId}`);

  // Ora aggiungiamo le traduzioni
  const otherLangs = ['de_DE', 'fr_FR', 'en_US'] as const;

  for (const langCode of otherLangs) {
    const langData = article.translations[langCode];
    if (!langData) {
      console.log(`⚠️ Traduzione ${langCode} non trovata, skip`);
      continue;
    }

    // Converti codice lingua (de_DE -> de_CH per Svizzera)
    const odooLangCode = LANG_MAP[langCode] || langCode;

    // Verifica che la lingua sia installata
    const isInstalled = installedLangs.some(l => l.code === odooLangCode);
    if (!isInstalled) {
      console.log(`⚠️ Lingua ${odooLangCode} non installata su Odoo, skip`);
      continue;
    }

    const flagEmoji = langCode === 'de_DE' ? '🇩🇪🇨🇭' : langCode === 'fr_FR' ? '🇫🇷🇨🇭' : '🇺🇸';
    console.log(`\n${flagEmoji} Aggiunta traduzione ${langCode} -> ${odooLangCode}...`);

    await odoo.updateBlogPost(postId, {
      name: langData.name,
      subtitle: langData.subtitle,
      content: langData.content_html,
      website_meta_title: langData.meta.title,
      website_meta_description: langData.meta.description,
      website_meta_keywords: langData.meta.keywords
    }, odooLangCode);

    console.log(`✅ Traduzione ${odooLangCode} aggiunta`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 ARTICOLO CARICATO CON SUCCESSO!');
  console.log('='.repeat(50));
  console.log(`📌 ID Odoo: ${postId}`);
  console.log(`📝 Titolo: ${itData.name}`);
  console.log(`🌐 Lingue: IT, DE, FR, EN`);
  console.log(`📊 Stato: NON PUBBLICATO (da verificare)`);
  console.log('\n⚠️ L\'articolo è stato creato come BOZZA.');
  console.log('   Vai su Odoo per verificarlo e pubblicarlo.');

  return postId;
}

// Main
const articleFile = process.argv[2];
if (!articleFile) {
  console.error('❌ Uso: npx tsx scripts/upload-article.ts <article-file.json>');
  console.error('   Esempio: npx tsx scripts/upload-article.ts data/new-articles/article-01-zurich.json');
  process.exit(1);
}

uploadArticle(articleFile)
  .then(id => {
    console.log(`\n✅ Completato. ID articolo: ${id}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Errore:', err.message);
    process.exit(1);
  });
