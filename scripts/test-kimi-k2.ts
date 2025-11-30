/**
 * Test Script for Kimi K2 Integration
 *
 * Run with: npx ts-node scripts/test-kimi-k2.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createKimiK2Client } from '../lib/ai/kimi-k2-client';
import { createDocumentClassifier } from '../lib/ai/document-classifier';

const SAMPLE_INVOICE_TEXT = `
FATTURA N. 2025/001
Data: 15 Gennaio 2025

Fornitore: LAPA Food Distribution SA
Via Example 123, Lugano
P.IVA: CHE-123.456.789

Cliente: Ristorante Da Mario
Via Roma 45, Milano
P.IVA: IT12345678901

Prodotti:
1. Mozzarella di Bufala DOP - 10 kg x €15.00 = €150.00
2. Parmigiano Reggiano 24 mesi - 5 kg x €28.00 = €140.00
3. Burrata Pugliese - 20 pz x €4.50 = €90.00

Subtotale: €380.00
IVA 10%: €38.00
TOTALE: €418.00

Pagamento: Bonifico Bancario
Scadenza: 30/01/2025
`;

const SAMPLE_ORDER_TEXT = `
ORDINE DI ACQUISTO N. ORD-2025-042
Data: 10 Gennaio 2025

Da: Ristorante Pizzeria Roma
A: LAPA Food Distribution SA

Consegna richiesta: 12 Gennaio 2025

Articoli ordinati:
- Mozzarella Fior di Latte: 15 kg
- Pomodori San Marzano: 30 kg
- Olio Extra Vergine: 10 L
- Prosciutto Crudo: 5 kg

Note: Consegna preferibilmente al mattino prima delle 10:00
`;

async function testKimiK2() {
  console.log('🚀 Testing Kimi K2 Integration...\n');

  const apiKey = process.env.KIMI_K2_API_KEY;

  if (!apiKey) {
    console.error('❌ KIMI_K2_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('✅ API Key found\n');

  // Test 1: Simple completion
  console.log('📝 Test 1: Simple Completion');
  console.log('─'.repeat(50));

  try {
    const client = createKimiK2Client(apiKey);
    const response = await client.complete(
      'Scrivi una breve descrizione di Kimi K2 in italiano (max 50 parole)',
      undefined,
      { maxTokens: 200, temperature: 0.7 }
    );

    console.log('Response:', response);
    console.log('✅ Test 1 passed\n');
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
    console.log('');
  }

  // Test 2: Invoice Classification
  console.log('📄 Test 2: Invoice Classification');
  console.log('─'.repeat(50));

  try {
    const classifier = createDocumentClassifier(apiKey);
    const result = await classifier.classifyFromText(SAMPLE_INVOICE_TEXT);

    console.log('Document Type:', result.typeName);
    console.log('Confidence:', result.confidence + '%');
    console.log('Details:', JSON.stringify(result.details, null, 2));
    console.log('✅ Test 2 passed\n');
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
    console.log('');
  }

  // Test 3: Order Classification
  console.log('📋 Test 3: Purchase Order Classification');
  console.log('─'.repeat(50));

  try {
    const classifier = createDocumentClassifier(apiKey);
    const result = await classifier.classifyFromText(SAMPLE_ORDER_TEXT);

    console.log('Document Type:', result.typeName);
    console.log('Confidence:', result.confidence + '%');
    console.log('Details:', JSON.stringify(result.details, null, 2));
    console.log('✅ Test 3 passed\n');
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
    console.log('');
  }

  // Test 4: Quick Detection
  console.log('⚡ Test 4: Quick Detection');
  console.log('─'.repeat(50));

  try {
    const classifier = createDocumentClassifier(apiKey);
    const result1 = await classifier.quickDetect(SAMPLE_INVOICE_TEXT);
    const result2 = await classifier.quickDetect(SAMPLE_ORDER_TEXT);

    console.log('Invoice quick detect:', result1);
    console.log('Order quick detect:', result2);
    console.log('✅ Test 4 passed\n');
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
    console.log('');
  }

  // Test 5: Code Review
  console.log('👨‍💻 Test 5: Code Review');
  console.log('─'.repeat(50));

  try {
    const client = createKimiK2Client(apiKey);
    const sampleCode = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}
    `;

    const result = await client.reviewCode(sampleCode, 'javascript');

    console.log('Summary:', result.summary);
    console.log('Issues:', result.issues.length);
    console.log('Suggestions:', result.suggestions.length);
    console.log('✅ Test 5 passed\n');
  } catch (error) {
    console.error('❌ Test 5 failed:', error);
    console.log('');
  }

  console.log('🎉 All tests completed!');
}

// Run tests
testKimiK2().catch(console.error);
