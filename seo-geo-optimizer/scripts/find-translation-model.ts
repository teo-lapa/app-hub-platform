/**
 * Cerca come Odoo gestisce le traduzioni dei blocchi HTML
 */

import { odoo } from '../src/connectors/odoo.js';

async function find() {
  await odoo.authenticate();
  console.log('Connesso a Odoo\n');

  // Cerca modelli con "translation" nel nome
  console.log('🔍 Cerco modelli con "translation"...');
  try {
    const models = await odoo['execute']<any[]>(
      'ir.model',
      'search_read',
      [[['model', 'ilike', 'translation']]],
      { fields: ['model', 'name'], limit: 20 }
    );
    console.log('Modelli trovati:');
    models.forEach(m => console.log(`  - ${m.model}: ${m.name}`));
  } catch (e: any) {
    console.log('Errore:', e.message.substring(0, 100));
  }

  // Cerca modelli website
  console.log('\n🔍 Cerco modelli "website"...');
  try {
    const models = await odoo['execute']<any[]>(
      'ir.model',
      'search_read',
      [[['model', 'ilike', 'website']]],
      { fields: ['model', 'name'], limit: 30 }
    );
    console.log('Modelli website:');
    models.slice(0, 15).forEach(m => console.log(`  - ${m.model}`));
  } catch (e: any) {
    console.log('Errore:', e.message.substring(0, 100));
  }

  // Prova a vedere i metodi disponibili per blog.post
  console.log('\n🔍 Metodi blog.post per traduzioni...');
  try {
    // Cerca se c'è un metodo get_field_translations
    const result = await odoo['execute']<any>(
      'blog.post',
      'get_field_translations',
      [[116], 'content'],
      {}
    );
    console.log('get_field_translations result:', result);
  } catch (e: any) {
    console.log('get_field_translations errore:', e.message.split('\n').slice(-2).join(' '));
  }

  // Prova con metodo diverso
  console.log('\n🔍 Provo _get_translation_records...');
  try {
    const result = await odoo['execute']<any>(
      'blog.post',
      '_get_translation_records',
      [[116]],
      {}
    );
    console.log('Risultato:', result);
  } catch (e: any) {
    console.log('Errore:', e.message.split('\n').slice(-2).join(' '));
  }
}

find().catch(console.error);
