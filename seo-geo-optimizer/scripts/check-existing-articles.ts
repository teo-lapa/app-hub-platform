/**
 * Controlla come sono tradotti gli articoli esistenti
 */

import { odoo } from '../src/connectors/odoo.js';

async function check() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  // Prendi i primi 5 articoli
  const articles = await odoo['execute']<any[]>(
    'blog.post',
    'search_read',
    [[]],
    { fields: ['id', 'name'], limit: 5, order: 'id asc' }
  );

  console.log('Primi 5 articoli:\n');

  for (const art of articles) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ARTICOLO ID: ${art.id} - ${art.name}`);
    console.log('='.repeat(60));

    for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
      const data = await odoo['execute']<any[]>(
        'blog.post',
        'read',
        [[art.id]],
        { fields: ['name', 'content'], context: { lang } }
      );

      if (data.length > 0) {
        const h1Match = data[0].content?.match(/<h[12][^>]*>([^<]+)<\/h[12]>/);
        const firstHeading = h1Match ? h1Match[1].substring(0, 50) : 'NO HEADING';
        console.log(`  ${lang}:`);
        console.log(`    Nome: ${data[0].name?.substring(0, 50)}...`);
        console.log(`    H1/H2: ${firstHeading}...`);
      }
    }
  }
}

check().catch(console.error);
