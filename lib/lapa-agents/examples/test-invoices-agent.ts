/**
 * ESEMPIO DI UTILIZZO - INVOICES AGENT
 *
 * Questo script mostra come usare l'InvoicesAgent per accedere
 * ai dati reali delle fatture da Odoo.
 */

import { getInvoicesAgent } from '../agents/invoices-agent';

async function testInvoicesAgent() {
  const agent = getInvoicesAgent();

  // ESEMPIO 1: Ottenere tutte le fatture di un cliente
  console.log('\n=== TEST 1: Fatture Cliente ===');
  const customerId = 123; // Sostituisci con un ID cliente reale
  const customerInvoicesResult = await agent.getCustomerInvoices(customerId);

  if (customerInvoicesResult.success) {
    console.log(`✅ Trovate ${customerInvoicesResult.data?.length} fatture`);
    console.log('Messaggio:', customerInvoicesResult.message?.it);

    // Mostra le prime 3 fatture
    customerInvoicesResult.data?.slice(0, 3).forEach(invoice => {
      console.log(`  - ${invoice.name}: CHF ${invoice.amount_total} (Stato: ${invoice.payment_state})`);
    });
  } else {
    console.error('❌ Errore:', customerInvoicesResult.error);
  }

  // ESEMPIO 2: Ottenere dettagli di una fattura specifica
  console.log('\n=== TEST 2: Dettagli Fattura ===');
  const invoiceId = 456; // Sostituisci con un ID fattura reale
  const detailsResult = await agent.getInvoiceDetails(invoiceId);

  if (detailsResult.success) {
    const invoice = detailsResult.data!;
    console.log(`✅ Fattura ${invoice.name}`);
    console.log(`   Cliente: ${invoice.partner_name}`);
    console.log(`   Totale: CHF ${invoice.amount_total}`);
    console.log(`   Da pagare: CHF ${invoice.amount_residual}`);
    console.log(`   Linee: ${invoice.lines.length}`);

    // Mostra le prime 3 linee
    invoice.lines.slice(0, 3).forEach(line => {
      const productName = Array.isArray(line.product_id) ? line.product_id[1] : 'N/A';
      console.log(`     - ${productName}: ${line.quantity} x CHF ${line.price_unit}`);
    });
  } else {
    console.error('❌ Errore:', detailsResult.error);
  }

  // ESEMPIO 3: Ottenere saldo cliente
  console.log('\n=== TEST 3: Saldo Cliente ===');
  const balanceResult = await agent.getCustomerBalance(customerId);

  if (balanceResult.success) {
    const balance = balanceResult.data!;
    console.log(`✅ Saldo ${balance.customer_name}`);
    console.log(`   Fatture totali: ${balance.invoices_count}`);
    console.log(`   Fatturato: ${balance.currency} ${balance.total_invoiced.toFixed(2)}`);
    console.log(`   Pagato: ${balance.currency} ${balance.total_paid.toFixed(2)}`);
    console.log(`   Da pagare: ${balance.currency} ${balance.total_due.toFixed(2)}`);
    console.log(`   Fatture scadute: ${balance.overdue_invoices}`);
  } else {
    console.error('❌ Errore:', balanceResult.error);
  }

  // ESEMPIO 4: Ottenere fatture in scadenza/scadute
  console.log('\n=== TEST 4: Fatture Scadute ===');
  const dueResult = await agent.getDueInvoices(customerId, 30); // prossimi 30 giorni

  if (dueResult.success) {
    console.log(`✅ ${dueResult.data?.length} fatture in scadenza`);
    console.log('Messaggio:', dueResult.message?.it);

    // Raggruppa per urgenza
    const byCriticality = {
      critical: dueResult.data?.filter(inv => inv.urgency === 'critical') || [],
      high: dueResult.data?.filter(inv => inv.urgency === 'high') || [],
      medium: dueResult.data?.filter(inv => inv.urgency === 'medium') || [],
      low: dueResult.data?.filter(inv => inv.urgency === 'low') || [],
    };

    console.log(`   🔴 Critiche (>30 giorni): ${byCriticality.critical.length}`);
    console.log(`   🟠 Alte (15-30 giorni): ${byCriticality.high.length}`);
    console.log(`   🟡 Medie (1-15 giorni): ${byCriticality.medium.length}`);
    console.log(`   🟢 Basse (in scadenza): ${byCriticality.low.length}`);

    // Mostra le più critiche
    byCriticality.critical.slice(0, 3).forEach(inv => {
      console.log(`     - ${inv.name}: ${inv.days_overdue} giorni di ritardo, CHF ${inv.amount_residual}`);
    });
  } else {
    console.error('❌ Errore:', dueResult.error);
  }

  // ESEMPIO 5: Ottenere statistiche per periodo
  console.log('\n=== TEST 5: Statistiche Periodo ===');
  const statsResult = await agent.getInvoiceStats('2024-01-01', '2024-12-31', customerId);

  if (statsResult.success) {
    const stats = statsResult.data!;
    console.log(`✅ Statistiche 2024`);
    console.log(`   Fatture: ${stats.total_invoices}`);
    console.log(`   Fatturato: ${stats.currency} ${stats.total_amount.toFixed(2)}`);
    console.log(`   Pagato: ${stats.currency} ${stats.total_paid.toFixed(2)}`);
    console.log(`   Da pagare: ${stats.currency} ${stats.total_due.toFixed(2)}`);
    console.log(`   Giorni medi pagamento: ${stats.avg_payment_days}`);
    console.log(`   Fatture scadute: ${stats.overdue_count}`);
  } else {
    console.error('❌ Errore:', statsResult.error);
  }

  // ESEMPIO 6: Generare link pagamento
  console.log('\n=== TEST 6: Link Pagamento ===');
  const linkResult = await agent.getPaymentLink(invoiceId);

  if (linkResult.success) {
    console.log(`✅ Link generato per ${linkResult.data?.invoice_name}`);
    console.log(`   URL: ${linkResult.data?.payment_url}`);
  } else {
    console.error('❌ Errore:', linkResult.error);
  }

  // ESEMPIO 7: Filtrare fatture per stato
  console.log('\n=== TEST 7: Fatture Aperte ===');
  const openResult = await agent.getInvoices(customerId, 'open', 100);

  if (openResult.success) {
    console.log(`✅ ${openResult.data?.length} fatture aperte`);

    const totalDue = openResult.data?.reduce((sum, inv) => sum + inv.amount_residual, 0) || 0;
    console.log(`   Totale da pagare: CHF ${totalDue.toFixed(2)}`);
  } else {
    console.error('❌ Errore:', openResult.error);
  }
}

// Esegui i test (decommenta per eseguire)
// testInvoicesAgent().catch(console.error);

export { testInvoicesAgent };
