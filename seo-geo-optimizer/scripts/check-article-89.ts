/**
 * Controlla articolo 89 (con contenuto strutturato)
 */

import { odoo } from '../src/connectors/odoo.js';

async function check() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  const artId = 89;

  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`LINGUA: ${lang}`);
    console.log('='.repeat(60));

    const data = await odoo['execute']<any[]>(
      'blog.post',
      'read',
      [[artId]],
      { fields: ['name', 'subtitle', 'content'], context: { lang } }
    );

    if (data.length > 0) {
      console.log(`Nome: ${data[0].name}`);
      console.log(`Subtitle: ${data[0].subtitle || '(vuoto)'}`);

      // Estrai tutti gli H2 e H3
      const headings = data[0].content?.match(/<h[23][^>]*>([^<]+)<\/h[23]>/g) || [];
      console.log(`\nHeadings trovati: ${headings.length}`);
      headings.slice(0, 5).forEach((h: string) => {
        const text = h.replace(/<[^>]+>/g, '');
        console.log(`  - ${text.substring(0, 60)}`);
      });

      // Primi 300 caratteri del contenuto testuale
      const textContent = data[0].content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`\nContenuto (300 chars): ${textContent?.substring(0, 300)}...`);
    }
  }
}

check().catch(console.error);
