import { getOdooSession, callOdoo } from '../lib/odoo-auth';

/**
 * Script per verificare i campi disponibili nel modello sale.order di Odoo,
 * con particolare attenzione ai campi note e note interne.
 */

async function checkSaleOrderFields() {
  try {
    console.log('🔍 VERIFICA CAMPI SALE.ORDER IN ODOO\n');
    console.log('='.repeat(60));

    // Get session
    const { cookies } = await getOdooSession();

    // Get all fields for sale.order model
    console.log('\n📋 Recupero campi del modello sale.order...\n');

    const fields = await callOdoo(
      cookies,
      'ir.model.fields',
      'search_read',
      [],
      {
        domain: [['model', '=', 'sale.order']],
        fields: ['name', 'field_description', 'ttype', 'help'],
      }
    );

    console.log(`✅ Trovati ${fields.length} campi totali\n`);
    console.log('='.repeat(60));

    // Filter note-related fields
    const noteFields = fields.filter((f: any) =>
      f.name.toLowerCase().includes('note') ||
      f.field_description.toLowerCase().includes('note') ||
      f.field_description.toLowerCase().includes('internal')
    );

    console.log('\n📝 CAMPI RELATIVI A NOTE:\n');
    noteFields.forEach((f: any) => {
      console.log(`Campo: ${f.name}`);
      console.log(`  Descrizione: ${f.field_description}`);
      console.log(`  Tipo: ${f.ttype}`);
      if (f.help) {
        console.log(`  Help: ${f.help}`);
      }
      console.log('');
    });

    console.log('='.repeat(60));

    // Search for specific fields we're interested in
    const interestingFields = ['note', 'internal_note', 'x_note', 'x_studio_note', 'comment'];

    console.log('\n🔎 RICERCA CAMPI SPECIFICI:\n');
    interestingFields.forEach(fieldName => {
      const field = fields.find((f: any) => f.name === fieldName);
      if (field) {
        console.log(`✅ Campo '${fieldName}' TROVATO:`);
        console.log(`   Descrizione: ${field.field_description}`);
        console.log(`   Tipo: ${field.ttype}`);
      } else {
        console.log(`❌ Campo '${fieldName}' NON trovato`);
      }
    });

    console.log('\n' + '='.repeat(60));

    // Get custom x_studio fields
    const customFields = fields.filter((f: any) => f.name.startsWith('x_studio'));

    console.log(`\n🎨 CAMPI CUSTOM (x_studio_*): ${customFields.length} trovati\n`);
    if (customFields.length > 0) {
      customFields.forEach((f: any) => {
        console.log(`  - ${f.name}: ${f.field_description} (${f.ttype})`);
      });
    } else {
      console.log('  Nessun campo custom trovato');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Verifica completata!\n');

  } catch (error: any) {
    console.error('❌ Errore durante la verifica:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

checkSaleOrderFields();
