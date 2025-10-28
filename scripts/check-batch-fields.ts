/**
 * Script per verificare i campi disponibili in stock.picking.batch
 * Serve per capire quali campi custom esistono veramente
 */

import { getOdooSessionId } from '../lib/odoo/odoo-helper';

async function checkBatchFields() {
  const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

  // Recupera session ID dal cookie manager
  const sessionId = await getOdooSessionId();

  if (!sessionId) {
    console.error('❌ Impossibile recuperare session ID');
    console.log('Assicurati di essere loggato in Odoo tramite l\'app');
    return;
  }

  console.log('✅ Session ID recuperata\n');

  console.log('🔍 Recupero campi del modello stock.picking.batch...\n');

  try {
    const response = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'ir.model.fields',
          method: 'search_read',
          args: [[['model', '=', 'stock.picking.batch']]],
          kwargs: {
            fields: ['name', 'field_description', 'ttype', 'relation', 'required'],
            limit: 200
          }
        },
        id: 1
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ Errore Odoo:', data.error);
      return;
    }

    const fields = data.result || [];

    console.log(`📊 Trovati ${fields.length} campi:\n`);

    // Filtra campi custom x_studio
    const customFields = fields.filter((f: any) => f.name.startsWith('x_studio'));

    console.log('🎨 CAMPI CUSTOM (x_studio_*):\n');
    customFields.forEach((field: any) => {
      console.log(`  • ${field.name}`);
      console.log(`    Tipo: ${field.ttype}${field.relation ? ` → ${field.relation}` : ''}`);
      console.log(`    Label: ${field.field_description}`);
      console.log(`    Required: ${field.required ? 'YES' : 'NO'}`);
      console.log('');
    });

    console.log('\n📋 CAMPI STANDARD RILEVANTI:\n');
    const relevantStandard = fields.filter((f: any) =>
      ['name', 'user_id', 'picking_ids', 'state', 'scheduled_date', 'picking_type_id'].includes(f.name)
    );

    relevantStandard.forEach((field: any) => {
      console.log(`  • ${field.name}`);
      console.log(`    Tipo: ${field.ttype}${field.relation ? ` → ${field.relation}` : ''}`);
      console.log(`    Required: ${field.required ? 'YES' : 'NO'}`);
      console.log('');
    });

    // Verifica se esistono i campi che cerchiamo
    const autistaField = fields.find((f: any) => f.name === 'x_studio_autista_del_giro');
    const autoField = fields.find((f: any) => f.name === 'x_studio_auto_del_giro');

    console.log('\n✅ VERIFICA CAMPI CERCATI:\n');
    if (autistaField) {
      console.log(`✓ x_studio_autista_del_giro ESISTE`);
      console.log(`  Tipo: ${autistaField.ttype} → ${autistaField.relation}`);
    } else {
      console.log(`✗ x_studio_autista_del_giro NON TROVATO`);
    }

    if (autoField) {
      console.log(`✓ x_studio_auto_del_giro ESISTE`);
      console.log(`  Tipo: ${autoField.ttype}`);
    } else {
      console.log(`✗ x_studio_auto_del_giro NON TROVATO`);
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

checkBatchFields();
