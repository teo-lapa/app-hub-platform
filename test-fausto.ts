/**
 * Test per verificare perché FAUSTO D'AGOSTINO non vede gli ordini di HALTEN GASTRO GMBH
 */

import { getOdooClient } from './lib/odoo-client';

async function testFausto() {
  console.log('=== TEST FAUSTO D\'AGOSTINO B2B ===\n');

  const odoo = await getOdooClient();

  // 1. Cerca FAUSTO D'AGOSTINO
  console.log('1. Cerco FAUSTO D\'AGOSTINO in Odoo...');
  const faustoResults = await odoo.searchRead(
    'res.partner',
    [['name', 'ilike', 'FAUSTO D\'AGOSTINO']],
    ['id', 'name', 'parent_id', 'is_company', 'type']
  );

  console.log('Risultati:', JSON.stringify(faustoResults, null, 2));

  if (faustoResults.length === 0) {
    console.log('❌ FAUSTO non trovato!');
    return;
  }

  const fausto = faustoResults[0];
  console.log(`\n✅ Trovato FAUSTO: ID=${fausto.id}, parent_id=${JSON.stringify(fausto.parent_id)}`);

  // 2. Verifica se ha parent_id
  const hasParent = fausto.parent_id && fausto.parent_id !== false;
  console.log(`\n2. Ha parent_id? ${hasParent ? 'SÌ' : 'NO'}`);

  if (hasParent) {
    const parentId = fausto.parent_id[0];
    const parentName = fausto.parent_id[1];
    console.log(`   Parent: ${parentName} (ID: ${parentId})`);

    // 3. Cerca tutti i contatti dell'azienda padre
    console.log(`\n3. Cerco tutti i contatti di ${parentName}...`);
    const siblings = await odoo.searchRead(
      'res.partner',
      [['parent_id', '=', parentId]],
      ['id', 'name'],
      100
    );

    const siblingIds = siblings.map((s: any) => s.id);
    const allIds = [parentId, ...siblingIds];
    console.log(`   Trovati ${siblings.length} contatti figli`);
    console.log(`   IDs totali per ricerca ordini: [${allIds.join(', ')}]`);

    // 4. Cerca ordini per TUTTI questi partner
    console.log(`\n4. Cerco ordini per tutti i ${allIds.length} partner...`);
    const ordersAll = await odoo.searchRead(
      'sale.order',
      [
        ['partner_id', 'in', allIds],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'name', 'partner_id', 'date_order', 'amount_total'],
      20
    );

    console.log(`   ✅ Trovati ${ordersAll.length} ordini company-wide:`);
    ordersAll.forEach((o: any) => {
      console.log(`      - ${o.name} (${o.date_order}) - Partner: ${o.partner_id[1]} - CHF ${o.amount_total}`);
    });

    // 5. Confronta con ordini solo di FAUSTO
    console.log(`\n5. Confronto: ordini SOLO di FAUSTO (ID: ${fausto.id})...`);
    const ordersFausto = await odoo.searchRead(
      'sale.order',
      [
        ['partner_id', '=', fausto.id],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'name', 'date_order', 'amount_total'],
      20
    );

    console.log(`   Trovati ${ordersFausto.length} ordini solo di FAUSTO:`);
    ordersFausto.forEach((o: any) => {
      console.log(`      - ${o.name} (${o.date_order}) - CHF ${o.amount_total}`);
    });

    // 6. Riepilogo
    console.log('\n=== RIEPILOGO ===');
    console.log(`FAUSTO ha parent_id: ${hasParent ? 'SÌ ✅' : 'NO ❌'}`);
    console.log(`Ordini company-wide: ${ordersAll.length}`);
    console.log(`Ordini solo FAUSTO: ${ordersFausto.length}`);

    if (ordersAll.length > ordersFausto.length) {
      console.log(`\n✅ Il sistema DOVREBBE mostrare ${ordersAll.length} ordini, non ${ordersFausto.length}!`);
    }

  } else {
    console.log('❌ FAUSTO non ha parent_id - viene trattato come cliente privato!');
  }
}

testFausto().catch(console.error);
