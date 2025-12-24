/**
 * Test script per HelpdeskAgent
 * Verifica l'integrazione con i dati reali di Odoo
 */

import { createHelpdeskAgent } from './helpdesk-agent';

async function testHelpdeskAgent() {
  console.log('═'.repeat(70));
  console.log('🧪 TEST HELPDESK AGENT - Integrazione Odoo');
  console.log('═'.repeat(70));

  try {
    // Crea agente (senza sessionId usa SessionManager automaticamente)
    console.log('\n1️⃣ Creazione Helpdesk Agent...');
    const agent = createHelpdeskAgent(undefined, 'it');
    console.log('✅ Agent creato');

    // Test 1: Crea un ticket di test
    console.log('\n2️⃣ Test creazione ticket...');
    const ticketResult = await agent.createTicket({
      customerId: 12, // Laura
      subject: 'Test Helpdesk Agent - Integrazione RPC',
      description: 'Questo è un ticket di test creato dall\'Helpdesk Agent aggiornato con integrazione RPC diretta.',
      priority: '1',
    });

    if (ticketResult.success) {
      console.log('✅ Ticket creato con successo!');
      console.log(`   Ticket ID: ${ticketResult.ticketId}`);
      console.log(`   Subject: ${ticketResult.ticket?.name}`);
      console.log(`   Customer: ${ticketResult.ticket?.partner_name || ticketResult.ticket?.partner_id}`);
    } else {
      console.log('❌ Errore creazione ticket:', ticketResult.error);
      return;
    }

    const ticketId = ticketResult.ticketId!;

    // Test 2: Ottieni dettagli ticket
    console.log('\n3️⃣ Test recupero dettagli ticket...');
    const detailsResult = await agent.getTicketDetails(ticketId);

    if (detailsResult.success) {
      console.log('✅ Dettagli recuperati con successo!');
      console.log(`   ID: ${detailsResult.ticket?.id}`);
      console.log(`   Subject: ${detailsResult.ticket?.name}`);
      console.log(`   Stage: ${detailsResult.ticket?.stage_name}`);
      console.log(`   Priority: ${detailsResult.ticket?.priority}`);
      console.log(`   Comments: ${detailsResult.comments?.length || 0}`);
    } else {
      console.log('❌ Errore recupero dettagli:', detailsResult.error);
    }

    // Test 3: Aggiungi commento
    console.log('\n4️⃣ Test aggiunta commento...');
    const commentResult = await agent.addComment(
      ticketId,
      'Questo è un commento di test aggiunto dall\'Helpdesk Agent.',
      false
    );

    if (commentResult.success) {
      console.log('✅ Commento aggiunto con successo!');
      console.log(`   Comment ID: ${commentResult.commentId}`);
    } else {
      console.log('❌ Errore aggiunta commento:', commentResult.error);
    }

    // Test 4: Lista ticket del cliente
    console.log('\n5️⃣ Test lista ticket cliente...');
    const ticketsResult = await agent.getCustomerTickets(12); // Laura

    if (ticketsResult.success) {
      console.log('✅ Lista ticket recuperata con successo!');
      console.log(`   Totale ticket: ${ticketsResult.count}`);
      if (ticketsResult.tickets && ticketsResult.tickets.length > 0) {
        console.log('\n   Ultimi 3 ticket:');
        ticketsResult.tickets.slice(0, 3).forEach((t, i) => {
          console.log(`   ${i + 1}. [#${t.id}] ${t.name}`);
          console.log(`      Stage: ${t.stage_name}, Priority: ${t.priority}`);
        });
      }
    } else {
      console.log('❌ Errore recupero lista:', ticketsResult.error);
    }

    // Test 5: Escalation
    console.log('\n6️⃣ Test escalation a supporto umano...');
    const escalationResult = await agent.escalateToHuman(
      ticketId,
      'Test di escalation automatica - richiesta assistenza specializzata',
      8 // Laura Teodorescu
    );

    if (escalationResult.success) {
      console.log('✅ Ticket escalato con successo!');
    } else {
      console.log('❌ Errore escalation:', escalationResult.error);
    }

    console.log('\n═'.repeat(70));
    console.log('✅ TEST COMPLETATI CON SUCCESSO');
    console.log('═'.repeat(70));

  } catch (error: any) {
    console.error('\n❌ Errore durante i test:', error.message);
    console.error(error);
  }
}

// Esegui i test
testHelpdeskAgent();
