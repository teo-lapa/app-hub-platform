import { odoo } from '../src/connectors/odoo.js';

async function checkArticle() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  const languages = ['it_IT', 'de_CH', 'fr_CH', 'en_US'];

  for (const lang of languages) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`LINGUA: ${lang}`);
    console.log('='.repeat(60));

    const articles = await odoo.getBlogPosts({ limit: 1, lang });

    // Cerca l'articolo 115
    const result = await odoo['execute']<any[]>(
      'blog.post',
      'read',
      [[115]],
      {
        fields: ['name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description'],
        context: { lang }
      }
    );

    if (result.length > 0) {
      const art = result[0];
      console.log(`Titolo: ${art.name}`);
      console.log(`Subtitle: ${art.subtitle || '(vuoto)'}`);
      console.log(`Meta Title: ${art.website_meta_title || '(vuoto)'}`);
      console.log(`Meta Desc: ${art.website_meta_description || '(vuoto)'}`);
      console.log(`Contenuto (primi 200 char): ${(art.content || '').substring(0, 200)}...`);
    } else {
      console.log('Articolo non trovato');
    }
  }
}

checkArticle().catch(console.error);
