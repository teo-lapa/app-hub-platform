/**
 * Investigare come Odoo gestisce le traduzioni per blog.post
 */

import { odoo } from '../src/connectors/odoo.js';

async function investigate() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  // 1. Verifica i campi traducibili di blog.post
  console.log('📋 Verifica campi blog.post...');
  const fields = await odoo['execute']<any>(
    'blog.post',
    'fields_get',
    [],
    { attributes: ['translate', 'type'] }
  );

  console.log('\nCampi traducibili (translate=true):');
  for (const [name, info] of Object.entries(fields) as [string, any][]) {
    if (info.translate) {
      console.log(`  - ${name} (${info.type})`);
    }
  }

  // 2. Cerca traduzioni esistenti per l'articolo 115
  console.log('\n📝 Traduzioni esistenti per articolo 115...');
  const translations = await odoo['execute']<any[]>(
    'ir.translation',
    'search_read',
    [[
      ['res_id', '=', 115],
      ['name', 'like', 'blog.post']
    ]],
    { fields: ['name', 'lang', 'src', 'value', 'state'], limit: 50 }
  );

  console.log(`Trovate ${translations.length} traduzioni:`);
  for (const t of translations.slice(0, 20)) {
    const src = (t.src || '').substring(0, 50);
    const val = (t.value || '').substring(0, 50);
    console.log(`  [${t.lang}] ${t.name}: "${src}..." -> "${val}..."`);
  }

  // 3. Prova a leggere un articolo esistente con traduzioni funzionanti
  console.log('\n📰 Leggo articolo esistente (ID 89) per confronto...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH']) {
    const result = await odoo['execute']<any[]>(
      'blog.post',
      'read',
      [[89]],
      {
        fields: ['name', 'content'],
        context: { lang }
      }
    );
    const content = result[0]?.content || '';
    const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/);
    console.log(`  ${lang}: name="${result[0]?.name?.substring(0, 40)}..." H2="${h2Match ? h2Match[1].substring(0, 30) : 'N/A'}..."`);
  }
}

investigate().catch(console.error);
