/**
 * Contact Classifier Service - Usage Examples
 * Dimostra come usare il servizio di estrazione contatti
 */

const contactClassifier = require('./contact-classifier');

// ============================================================================
// ESEMPIO 1: Biglietto visita italiano
// ============================================================================

const businessCardText = `
ACME Corporation S.r.l.
Via Milano, 123
20100 Milano - Italia

Sig. Marco Rossi
Direttore Commerciale

Telefono: 02 1234 5678
Cellulare: +39 334 567 8901
Email: marco.rossi@acme.it
Fax: 02 1234 5679
Sito web: www.acme.it

Partita IVA: IT 01 234 567 890
Codice Fiscale: RSSMRC80A01H501Q
`;

// ============================================================================
// ESEMPIO 2: Fattura (estrazione da header)
// ============================================================================

const invoiceText = `
FATTURA N. 2025/001 - 15/01/2025

FORNITORE:
Ditta Bianchi & Soci S.r.l.
Via Torino 456
10100 Torino - Italia
P.IVA: 12 345 678 901
CF: BNCFAB75R23E379Z
Tel: 011 555 6666
Email: info@bianchi-soci.it
Sito: https://www.bianchi-soci.it

CLIENTE:
Sig.ra Lucia Verdi
Azienda XYZ S.p.A.
Via Roma 789
30100 Venezia

Contacts:
Telefono: 041 234 5678
Mobile: +39 347 123 4567
Email: lucia.verdi@xyz.it
`;

// ============================================================================
// ESEMPIO 3: Carta da lettere
// ============================================================================

const letterheadText = `
STUDIO LEGALE ROSSI & ASSOCIATI

Avv. Giovanni Rossi
Specializzato in Diritto Commerciale

Studio Legale Rossi & Associati
Corso Vittorio Emanuele II, 50
10123 Torino
Italia

Telefono: +39 011 123 4567
Fax: +39 011 123 4568
Email: g.rossi@studiolegalrossitoria.it
Mobile: 339 123 4567
Web: www.studiolegalrossi.it

C.F.: RSSGVN70A01L219X
Partita IVA: 10 987 654 321
`;

// ============================================================================
// MAIN - Esecuzione esempi
// ============================================================================

async function main() {
  try {
    console.log('\n=== CONTACT CLASSIFIER SERVICE - EXAMPLES ===\n');

    // Inizializza servizio
    console.log('Initializing Contact Classifier Service...');
    await contactClassifier.initialize();
    console.log('✅ Service initialized\n');

    // ====== ESEMPIO 1 ======
    console.log('─'.repeat(80));
    console.log('EXAMPLE 1: Biglietto Visita Italiano');
    console.log('─'.repeat(80));

    console.log('\nInput text:');
    console.log(businessCardText);

    console.log('\nExtracting contact information...');
    const result1 = await contactClassifier.extractContact(businessCardText);

    console.log('\nExtracted contact:');
    console.log(JSON.stringify(result1, null, 2));

    // ====== ESEMPIO 2 ======
    console.log('\n' + '─'.repeat(80));
    console.log('EXAMPLE 2: Intestazione Fattura');
    console.log('─'.repeat(80));

    console.log('\nInput text:');
    console.log(invoiceText);

    console.log('\nExtracting contact information...');
    const result2 = await contactClassifier.extractContact(invoiceText);

    console.log('\nExtracted contact:');
    console.log(JSON.stringify(result2, null, 2));

    // ====== ESEMPIO 3 ======
    console.log('\n' + '─'.repeat(80));
    console.log('EXAMPLE 3: Carta da Lettere Studio Legale');
    console.log('─'.repeat(80));

    console.log('\nInput text:');
    console.log(letterheadText);

    console.log('\nExtracting contact information...');
    const result3 = await contactClassifier.extractContact(letterheadText);

    console.log('\nExtracted contact:');
    console.log(JSON.stringify(result3, null, 2));

    // ====== ESTRAZIONE PER ODOO ======
    console.log('\n' + '─'.repeat(80));
    console.log('EXAMPLE 4: Estrazione per Odoo res.partner');
    console.log('─'.repeat(80));

    console.log('\nExtracting for Odoo (Business Card):');
    const odooData1 = await contactClassifier.extractForOdoo(businessCardText);
    console.log(JSON.stringify(odooData1, null, 2));

    console.log('\n✅ Odoo-ready data:');
    console.log(`name: ${odooData1.name}`);
    console.log(`email: ${odooData1.email}`);
    console.log(`phone: ${odooData1.phone}`);
    console.log(`mobile: ${odooData1.mobile}`);
    console.log(`vat: ${odooData1.vat} (sanitizzato)`);
    console.log(`website: ${odooData1.website}`);
    console.log(`isCompany: ${odooData1.isCompany}`);

    // ====== QUALITY METRICS ======
    console.log('\n' + '─'.repeat(80));
    console.log('Quality Metrics Summary');
    console.log('─'.repeat(80));

    console.log(`\nBusiness Card Extraction:`);
    console.log(`  Confidence: ${result1.confidence}%`);
    console.log(`  Duration: ${result1.duration}ms`);
    console.log(`  Fields extracted: ${result1.extractedFields.length}`);
    console.log(`  Fields: ${result1.extractedFields.join(', ')}`);

    console.log(`\nInvoice Extraction:`);
    console.log(`  Confidence: ${result2.confidence}%`);
    console.log(`  Duration: ${result2.duration}ms`);
    console.log(`  Fields extracted: ${result2.extractedFields.length}`);
    console.log(`  Fields: ${result2.extractedFields.join(', ')}`);

    console.log(`\nLetter Extraction:`);
    console.log(`  Confidence: ${result3.confidence}%`);
    console.log(`  Duration: ${result3.duration}ms`);
    console.log(`  Fields extracted: ${result3.extractedFields.length}`);
    console.log(`  Fields: ${result3.extractedFields.join(', ')}`);

    // ====== CHAT INTERATTIVO ======
    console.log('\n' + '─'.repeat(80));
    console.log('EXAMPLE 5: Chat Interattivo');
    console.log('─'.repeat(80));

    console.log('\nChitting about the business card...');
    let conversation = [];

    // Domanda 1
    let response = await contactClassifier.chat(
      'Chi è il contatto principale e qual è il suo ruolo?',
      conversation
    );
    console.log(`\nQ: Chi è il contatto principale e qual è il suo ruolo?`);
    console.log(`A: ${response.message}`);
    conversation = response.conversation;

    // Domanda 2
    response = await contactClassifier.chat(
      'Qual è l\'indirizzo di questa azienda?',
      conversation
    );
    console.log(`\nQ: Qual è l'indirizzo di questa azienda?`);
    console.log(`A: ${response.message}`);
    conversation = response.conversation;

    // ====== DOMANDE SUL DOCUMENTO ======
    console.log('\n' + '─'.repeat(80));
    console.log('EXAMPLE 6: Domande sul Documento');
    console.log('─'.repeat(80));

    console.log('\nAsking specific questions...');

    const q1 = await contactClassifier.askContact(
      businessCardText,
      'Qual è la P.IVA dell\'azienda?'
    );
    console.log(`Q: Qual è la P.IVA dell'azienda?`);
    console.log(`A: ${q1.answer}`);
    console.log(`Confidence: ${q1.confidence}%`);

    const q2 = await contactClassifier.askContact(
      businessCardText,
      'Quali sono i numeri di telefono disponibili?'
    );
    console.log(`\nQ: Quali sono i numeri di telefono disponibili?`);
    console.log(`A: ${q2.answer}`);
    console.log(`Confidence: ${q2.confidence}%`);

    // ====== RISULTATO FINALE ======
    console.log('\n' + '='.repeat(80));
    console.log('ALL EXAMPLES COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Ollama')) {
      console.error('\nTroubleshooting:');
      console.error('1. Check if Ollama is running: sudo systemctl status ollama');
      console.error('2. Check if llama3.2:3b is installed: ollama list');
      console.error('3. Download model if needed: ollama pull llama3.2:3b');
      console.error('4. Verify Ollama endpoint: curl http://localhost:11434/api/tags');
    }
  }
}

// ============================================================================
// Esecuzione
// ============================================================================

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { contactClassifier };
