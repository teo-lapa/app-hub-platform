import { getOdooSession, callOdoo } from '../lib/odoo-auth';

/**
 * Script per testare la funzionalità delle note negli ordini:
 * 1. Crea un ordine di test con entrambe le note (orderNotes e warehouseNotes)
 * 2. Verifica che warehouseNotes sia nel campo internal_note
 * 3. Verifica che orderNotes sia nel chatter come messaggio pubblico
 */

async function testNoteFunctionality() {
  try {
    console.log('🧪 TEST FUNZIONALITA NOTE NEGLI ORDINI\n');
    console.log('='.repeat(60));

    // Get session
    const { cookies } = await getOdooSession();

    // 1. Find a customer for testing
    console.log('\n🔍 Ricerca cliente per il test...\n');
    const customers = await callOdoo(
      cookies,
      'res.partner',
      'search_read',
      [],
      {
        domain: [['customer_rank', '>', 0], ['active', '=', true]],
        fields: ['id', 'name', 'email'],
        limit: 1
      }
    );

    if (!customers || customers.length === 0) {
      console.error('❌ Nessun cliente trovato per il test');
      return;
    }

    const customer = customers[0];
    console.log(`✅ Cliente trovato: ${customer.name} (ID: ${customer.id})\n`);

    // 2. Find a product for testing
    console.log('🔍 Ricerca prodotto per il test...\n');
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [['sale_ok', '=', true], ['active', '=', true]],
        fields: ['id', 'name', 'default_code'],
        limit: 1
      }
    );

    if (!products || products.length === 0) {
      console.error('❌ Nessun prodotto trovato per il test');
      return;
    }

    const product = products[0];
    console.log(`✅ Prodotto trovato: ${product.name} (ID: ${product.id})\n`);

    console.log('='.repeat(60));
    console.log('\n📝 Creazione ordine di test...\n');

    // 3. Create test order with notes
    const testOrderNotes = 'Questo è un messaggio VISIBILE AL CLIENTE.\nDeve apparire nel chatter come messaggio pubblico.';
    const testWarehouseNotes = 'Questa è una nota INTERNA per il magazzino.\nDeve andare nel campo internal_note e NON essere visibile al cliente.';

    const orderData = {
      partner_id: customer.id,
      partner_shipping_id: customer.id,
      date_order: new Date().toISOString().slice(0, 19).replace('T', ' '),
      state: 'draft',
      origin: 'TEST NOTES FUNCTIONALITY',
      company_id: 1,
      internal_note: testWarehouseNotes, // Note magazzino (interne)
    };

    console.log('Dati ordine:');
    console.log(`  - Cliente: ${customer.name}`);
    console.log(`  - Origine: ${orderData.origin}`);
    console.log(`  - Note Venditore (per chatter): "${testOrderNotes}"`);
    console.log(`  - Note Magazzino (internal_note): "${testWarehouseNotes}"\n`);

    const orderId = await callOdoo(
      cookies,
      'sale.order',
      'create',
      [orderData],
      {}
    );

    console.log(`✅ Ordine creato con ID: ${orderId}\n`);

    // 4. Create order line
    const orderLineData = {
      order_id: orderId,
      product_id: product.id,
      product_uom_qty: 1,
      company_id: 1,
    };

    await callOdoo(
      cookies,
      'sale.order.line',
      'create',
      [orderLineData],
      {}
    );

    console.log('✅ Riga ordine creata\n');

    // 5. Post order notes to chatter (customer-visible)
    console.log('📝 Invio note venditore al chatter...\n');

    const notesMessage = `<p><strong>💬 Note Ordine dal Cliente</strong></p><p>${testOrderNotes.replace(/\n/g, '<br/>')}</p><p><em>Inserite dal venditore tramite Catalogo Venditori</em></p>`;

    await callOdoo(
      cookies,
      'sale.order',
      'message_post',
      [[orderId]],
      {
        body: notesMessage,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment', // Public message
      }
    );

    console.log('✅ Note venditore inviate al chatter\n');

    console.log('='.repeat(60));
    console.log('\n🔍 VERIFICA DEI RISULTATI\n');

    // 6. Read back the order to verify
    const createdOrder = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: ['name', 'internal_note', 'note'],
        limit: 1
      }
    );

    if (createdOrder && createdOrder.length > 0) {
      const order = createdOrder[0];
      console.log(`Ordine: ${order.name}\n`);

      // Check internal_note field
      console.log('✓ CAMPO internal_note (Note Magazzino):');
      if (order.internal_note) {
        console.log(`  Valore: "${order.internal_note}"`);
        if (order.internal_note === testWarehouseNotes) {
          console.log('  ✅ CORRETTO: Le note magazzino sono nel campo internal_note\n');
        } else {
          console.log('  ⚠️ ATTENZIONE: Il valore non corrisponde esattamente\n');
        }
      } else {
        console.log('  ❌ ERRORE: Campo internal_note vuoto!\n');
      }

      // Check note field (should be empty or terms & conditions)
      console.log('✓ CAMPO note (Terms and Conditions):');
      if (order.note) {
        console.log(`  Valore: "${order.note}"`);
        console.log('  ℹ️ Questo campo contiene termini e condizioni standard\n');
      } else {
        console.log('  Vuoto (normale)\n');
      }
    }

    // 7. Read chatter messages to verify order notes
    console.log('✓ MESSAGGI NEL CHATTER:');
    const messages = await callOdoo(
      cookies,
      'mail.message',
      'search_read',
      [],
      {
        domain: [
          ['model', '=', 'sale.order'],
          ['res_id', '=', orderId]
        ],
        fields: ['body', 'message_type', 'subtype_id'],
        order: 'id desc',
        limit: 5
      }
    );

    if (messages && messages.length > 0) {
      console.log(`  Trovati ${messages.length} messaggi\n`);

      let foundOrderNotes = false;
      messages.forEach((msg: any, index: number) => {
        console.log(`  Messaggio ${index + 1}:`);

        // Remove HTML tags for display
        const plainText = msg.body
          ?.replace(/<[^>]*>/g, ' ')
          ?.replace(/\s+/g, ' ')
          ?.trim()
          ?.substring(0, 100);

        console.log(`    Tipo: ${msg.message_type}`);
        console.log(`    Contenuto: ${plainText || '(vuoto)'}...`);

        if (msg.body && msg.body.includes('Note Ordine dal Cliente')) {
          foundOrderNotes = true;
          console.log('    ✅ QUESTO E\' IL MESSAGGIO CON LE NOTE VENDITORE!');
        }
        console.log('');
      });

      if (foundOrderNotes) {
        console.log('  ✅ CORRETTO: Le note venditore sono nel chatter\n');
      } else {
        console.log('  ⚠️ ATTENZIONE: Note venditore non trovate nel chatter\n');
      }
    } else {
      console.log('  ❌ ERRORE: Nessun messaggio trovato nel chatter\n');
    }

    console.log('='.repeat(60));
    console.log('\n📊 RIEPILOGO FINALE\n');
    console.log(`Ordine di test creato: ${createdOrder[0].name}`);
    console.log(`ID Odoo: ${orderId}`);
    console.log('\nCampi utilizzati:');
    console.log('  ✓ internal_note: Note Magazzino (interne, non visibili al cliente)');
    console.log('  ✓ Chatter (message_post): Note Venditore (visibili al cliente)');
    console.log('\n🎉 TEST COMPLETATO!\n');
    console.log(`Puoi verificare l'ordine in Odoo:`);
    console.log(`https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#id=${orderId}&model=sale.order&view_type=form\n`);

  } catch (error: any) {
    console.error('❌ Errore durante il test:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testNoteFunctionality();
