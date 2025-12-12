import { odoo } from '../src/connectors/odoo.js';
import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

async function addTranslations() {
  await odoo.authenticate();
  console.log('Connesso a Odoo');

  // Aggiungi traduzione tedesca (de_CH)
  console.log('Aggiunta traduzione DE (de_CH)...');
  const deData = article.translations.de_DE;
  await odoo.updateBlogPost(115, {
    name: deData.name,
    subtitle: deData.subtitle,
    content: deData.content_html,
    website_meta_title: deData.meta.title,
    website_meta_description: deData.meta.description,
    website_meta_keywords: deData.meta.keywords
  }, 'de_CH');
  console.log('✅ Traduzione DE aggiunta!');

  // Aggiungi traduzione francese (fr_CH)
  console.log('Aggiunta traduzione FR (fr_CH)...');
  const frData = article.translations.fr_FR;
  await odoo.updateBlogPost(115, {
    name: frData.name,
    subtitle: frData.subtitle,
    content: frData.content_html,
    website_meta_title: frData.meta.title,
    website_meta_description: frData.meta.description,
    website_meta_keywords: frData.meta.keywords
  }, 'fr_CH');
  console.log('✅ Traduzione FR aggiunta!');

  console.log('\n🎉 Tutte le traduzioni aggiunte all\'articolo 115!');
}

addTranslations().catch(console.error);
